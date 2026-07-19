begin;

alter table public.provider_health
  add column if not exists availability numeric(6,2) not null default 100,
  add column if not exists error_rate numeric(6,2) not null default 0,
  add column if not exists rate_limit_remaining numeric(12,2),
  add column if not exists api_points_remaining numeric(12,2),
  add column if not exists status_message text;

create table if not exists public.worker_heartbeats (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid
    references public.organisations(id)
    on delete cascade,
  store_id uuid
    references public.stores(id)
    on delete cascade,
  worker_key text not null unique,
  worker_id text not null,
  queue_name text not null,
  version text not null default 'dev',
  host text,
  status text not null default 'healthy'
    check (status in ('healthy', 'warning', 'offline')),
  memory_mb numeric(10,2),
  cpu_percent numeric(6,2),
  metadata jsonb not null default '{}'::jsonb,
  heartbeat_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.queue_metrics (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null
    references public.organisations(id)
    on delete cascade,
  store_id uuid not null
    references public.stores(id)
    on delete cascade,
  queue_name text not null,
  queued integer not null default 0,
  running integer not null default 0,
  retrying integer not null default 0,
  completed integer not null default 0,
  failed integer not null default 0,
  cancelled integer not null default 0,
  dead_letter integer not null default 0,
  oldest_message_age_seconds integer not null default 0,
  messages_per_hour numeric(10,2) not null default 0,
  failures_per_hour numeric(10,2) not null default 0,
  average_processing_time_ms integer not null default 0,
  stale_jobs integer not null default 0,
  recorded_at timestamptz not null default now()
);

create table if not exists public.system_metrics (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null
    references public.organisations(id)
    on delete cascade,
  store_id uuid not null
    references public.stores(id)
    on delete cascade,
  metric_key text not null,
  metric_value numeric(18,6) not null default 0,
  metric_unit text,
  metadata jsonb not null default '{}'::jsonb,
  recorded_at timestamptz not null default now()
);

create table if not exists public.operation_snapshots (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null
    references public.organisations(id)
    on delete cascade,
  store_id uuid not null
    references public.stores(id)
    on delete cascade,
  snapshot_key text not null default 'operations',
  payload jsonb not null default '{}'::jsonb,
  generated_at timestamptz not null default now(),
  unique (organisation_id, store_id, snapshot_key)
);

create index if not exists idx_worker_heartbeats_latest
  on public.worker_heartbeats(queue_name, heartbeat_at desc);

create index if not exists idx_queue_metrics_tenant
  on public.queue_metrics(
    organisation_id,
    store_id,
    queue_name,
    recorded_at desc
  );

create index if not exists idx_system_metrics_tenant
  on public.system_metrics(
    organisation_id,
    store_id,
    metric_key,
    recorded_at desc
  );

create index if not exists idx_operation_snapshots_tenant
  on public.operation_snapshots(
    organisation_id,
    store_id,
    generated_at desc
  );

alter table public.worker_heartbeats enable row level security;
alter table public.queue_metrics enable row level security;
alter table public.system_metrics enable row level security;
alter table public.operation_snapshots enable row level security;

drop policy if exists "Members read worker heartbeats" on public.worker_heartbeats;
create policy "Members read worker heartbeats"
on public.worker_heartbeats for select to authenticated
using (
  (organisation_id is null and store_id is null)
  or (
    public.is_organisation_member(organisation_id)
    and public.can_access_store(store_id)
  )
);

drop policy if exists "Members read queue metrics" on public.queue_metrics;
create policy "Members read queue metrics"
on public.queue_metrics for select to authenticated
using (
  public.is_organisation_member(organisation_id)
  and public.can_access_store(store_id)
);

drop policy if exists "Members read system metrics" on public.system_metrics;
create policy "Members read system metrics"
on public.system_metrics for select to authenticated
using (
  public.is_organisation_member(organisation_id)
  and public.can_access_store(store_id)
);

drop policy if exists "Members read operation snapshots" on public.operation_snapshots;
create policy "Members read operation snapshots"
on public.operation_snapshots for select to authenticated
using (
  public.is_organisation_member(organisation_id)
  and public.can_access_store(store_id)
);

commit;
