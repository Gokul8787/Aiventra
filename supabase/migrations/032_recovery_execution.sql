begin;

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
      'supplier_order_creation',
      'supplier_order_status_sync',
      'supplier_tracking_sync',
      'shopify_fulfilment',
      'stale_job_recovery',
      'product_publication',
      'marketing_generation',
      'order_fulfilment',
      'tracking_sync',
      'order_cancellation',
      'supplier_cancellation',
      'recovery_retry',
      'dead_letter_replay'
    )
  );

alter table public.cancellation_requests
  add column if not exists decision text
    check (
      decision in (
        'NO_ACTION',
        'CANCEL_QUEUED_WORK',
        'CANCEL_SUPPLIER_ORDER',
        'CANCEL_PLATFORM_FULFILMENT',
        'MANUAL_REVIEW',
        'TOO_LATE'
      )
    ),
  add column if not exists confidence numeric(5,2),
  add column if not exists decision_reasons jsonb
    not null default '[]'::jsonb,
  add column if not exists attempt_count integer
    not null default 0,
  add column if not exists max_attempts integer
    not null default 5,
  add column if not exists next_retry_at timestamptz,
  add column if not exists last_error text,
  add column if not exists processing_started_at timestamptz,
  add column if not exists processing_completed_at timestamptz;

create table if not exists public.recovery_attempts (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null
    references public.organisations(id)
    on delete cascade,
  store_id uuid not null
    references public.stores(id)
    on delete cascade,
  cancellation_request_id uuid not null
    references public.cancellation_requests(id)
    on delete cascade,
  attempt_number integer not null,
  action text not null,
  status text not null
    check (
      status in (
        'running',
        'completed',
        'retrying',
        'failed',
        'dead_letter'
      )
    ),
  retryable boolean,
  error_code text,
  error_message text,
  metadata jsonb not null default '{}'::jsonb,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  unique (
    cancellation_request_id,
    attempt_number,
    action
  )
);

create table if not exists public.dead_letter_items (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null
    references public.organisations(id)
    on delete cascade,
  store_id uuid not null
    references public.stores(id)
    on delete cascade,
  source_queue text not null,
  job_id uuid
    references public.ai_jobs(id)
    on delete set null,
  cancellation_request_id uuid
    references public.cancellation_requests(id)
    on delete set null,
  job_type text not null,
  payload jsonb not null default '{}'::jsonb,
  error_code text,
  error_message text,
  attempt_count integer not null,
  max_attempts integer not null,
  status text not null default 'open'
    check (
      status in (
        'open',
        'requeued',
        'resolved',
        'ignored'
      )
    ),
  idempotency_key text not null unique,
  created_at timestamptz not null default now(),
  requeued_at timestamptz,
  resolved_at timestamptz
);

create index if not exists idx_cancellation_retry
  on public.cancellation_requests(
    status,
    next_retry_at
  );

create index if not exists idx_recovery_attempts_request
  on public.recovery_attempts(
    cancellation_request_id,
    attempt_number desc
  );

create index if not exists idx_dead_letter_open
  on public.dead_letter_items(
    organisation_id,
    store_id,
    status,
    created_at desc
  );

alter table public.recovery_attempts enable row level security;
alter table public.dead_letter_items enable row level security;

commit;
