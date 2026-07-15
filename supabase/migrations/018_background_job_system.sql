begin;

do $$
declare
  queue_name text;
begin
  foreach queue_name in array array[
    'aiventra-jobs',
    'aiventra-cj',
    'aiventra-dead-letter'
  ]
  loop
    begin
      perform pgmq.create(queue_name);
    exception
      when invalid_schema_name or undefined_function then
        raise notice 'Supabase Queues/pgmq is not available in this database yet. Enable Queues before running workers.';
      when duplicate_object then
        null;
    end;
  end loop;
end $$;

alter table public.ai_jobs
  add column if not exists organisation_id uuid
    references public.organisations(id)
    on delete cascade,
  add column if not exists store_id uuid
    references public.stores(id)
    on delete cascade,
  add column if not exists queue_name text,
  add column if not exists queue_message_id bigint,
  add column if not exists current_step text,
  add column if not exists worker_id text,
  add column if not exists correlation_id uuid,
  add column if not exists causation_id uuid,
  add column if not exists attempt_count integer
    not null default 0,
  add column if not exists max_attempts integer
    not null default 5,
  add column if not exists heartbeat_at timestamptz,
  add column if not exists next_retry_at timestamptz,
  add column if not exists result_reference jsonb
    not null default '{}'::jsonb,
  add column if not exists idempotency_key text;

alter table public.ai_jobs
  drop constraint if exists ai_jobs_status_check;

alter table public.ai_jobs
  add constraint ai_jobs_status_check
  check (
    status in (
      'queued',
      'running',
      'retrying',
      'completed',
      'failed',
      'cancelled',
      'dead_letter'
    )
  );

alter table public.ai_jobs
  drop constraint if exists ai_jobs_job_type_check;

alter table public.ai_jobs
  add constraint ai_jobs_job_type_check
  check (
    job_type in (
      'product_scan',
      'product_analysis',
      'evidence_refresh',
      'listing_generation',
      'shopify_draft_creation',
      'cj_product_refresh',
      'cj_shipping_quote',
      'cj_inventory_refresh',
      'cj_order_creation',
      'cj_tracking_sync',
      'order_validation',
      'stale_job_recovery',
      'product_publication',
      'marketing_generation',
      'order_fulfilment',
      'tracking_sync'
    )
  );

create unique index if not exists idx_ai_jobs_idempotency
  on public.ai_jobs(idempotency_key)
  where idempotency_key is not null;

create index if not exists idx_ai_jobs_queue_status
  on public.ai_jobs(queue_name, status, created_at);

create index if not exists idx_ai_jobs_stale
  on public.ai_jobs(status, heartbeat_at);

create table if not exists public.job_attempts (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid references public.organisations(id) on delete cascade,
  store_id uuid references public.stores(id) on delete cascade,
  job_id uuid not null references public.ai_jobs(id) on delete cascade,
  attempt_number integer not null,
  worker_id text,
  step text,
  status text not null check (status in ('running', 'completed', 'failed')),
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  error_code text,
  error_message text,
  retryable boolean,
  metadata jsonb not null default '{}'::jsonb,
  unique(job_id, attempt_number)
);

alter table public.job_attempts
  add column if not exists organisation_id uuid
    references public.organisations(id)
    on delete cascade,
  add column if not exists store_id uuid
    references public.stores(id)
    on delete cascade,
  add column if not exists error_code text,
  add column if not exists retryable boolean,
  add column if not exists metadata jsonb
    not null default '{}'::jsonb;

create table if not exists public.job_logs (
  id bigint generated always as identity primary key,
  organisation_id uuid references public.organisations(id) on delete cascade,
  store_id uuid references public.stores(id) on delete cascade,
  job_id uuid not null references public.ai_jobs(id) on delete cascade,
  level text not null check (level in ('debug', 'info', 'warning', 'error')),
  step text,
  message text not null,
  context jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.job_logs
  add column if not exists organisation_id uuid
    references public.organisations(id)
    on delete cascade,
  add column if not exists store_id uuid
    references public.stores(id)
    on delete cascade,
  add column if not exists step text;

create table if not exists public.provider_rate_limits (
  provider text primary key,
  next_allowed_at timestamptz not null default now(),
  minimum_interval_ms integer not null,
  updated_at timestamptz not null default now()
);

insert into public.provider_rate_limits (
  provider,
  minimum_interval_ms
)
values
  ('cj', 1000),
  ('openai', 100),
  ('shopify', 100),
  ('google_trends', 1000),
  ('reddit', 1000)
on conflict (provider) do update
set minimum_interval_ms = excluded.minimum_interval_ms;

create table if not exists public.scheduled_jobs (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  store_id uuid not null references public.stores(id) on delete cascade,
  job_type text not null,
  schedule text not null,
  payload jsonb not null default '{}'::jsonb,
  enabled boolean not null default true,
  last_enqueued_at timestamptz,
  next_run_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_job_attempts_job
  on public.job_attempts(job_id, attempt_number desc);

create index if not exists idx_job_logs_job
  on public.job_logs(job_id, created_at);

create index if not exists idx_scheduled_jobs_due
  on public.scheduled_jobs(enabled, next_run_at);

alter table public.job_attempts enable row level security;
alter table public.job_logs enable row level security;
alter table public.provider_rate_limits enable row level security;
alter table public.scheduled_jobs enable row level security;

drop policy if exists "Members read tenant job attempts" on public.job_attempts;
create policy "Members read tenant job attempts"
on public.job_attempts for select to authenticated
using (public.is_organisation_member(organisation_id) and public.can_access_store(store_id));

drop policy if exists "Members read tenant scheduled jobs" on public.scheduled_jobs;
create policy "Members read tenant scheduled jobs"
on public.scheduled_jobs for select to authenticated
using (public.is_organisation_member(organisation_id) and public.can_access_store(store_id));

create or replace function public.acquire_provider_permit(
  requested_provider text
)
returns table (
  granted boolean,
  retry_after_ms integer,
  permitted_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  rate_row public.provider_rate_limits%rowtype;
  current_time timestamptz := clock_timestamp();
  new_allowed_at timestamptz;
  wait_ms integer;
begin
  select *
  into rate_row
  from public.provider_rate_limits
  where provider = requested_provider
  for update;

  if not found then
    raise exception
      'Provider rate limit is not configured: %',
      requested_provider;
  end if;

  if rate_row.next_allowed_at <= current_time then
    new_allowed_at :=
      current_time +
      make_interval(
        secs =>
          rate_row.minimum_interval_ms::numeric /
          1000
      );

    update public.provider_rate_limits
    set
      next_allowed_at = new_allowed_at,
      updated_at = current_time
    where provider = requested_provider;

    return query
    select
      true,
      0,
      current_time;

    return;
  end if;

  wait_ms :=
    greatest(
      1,
      ceil(
        extract(
          epoch from (
            rate_row.next_allowed_at -
            current_time
          )
        ) * 1000
      )::integer
    );

  return query
  select
    false,
    wait_ms,
    rate_row.next_allowed_at;
end;
$$;

revoke all on function public.acquire_provider_permit(text) from public;
grant execute on function public.acquire_provider_permit(text) to service_role;

commit;
