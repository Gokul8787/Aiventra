begin;

create table if not exists public.domain_events (
  id uuid primary key default gen_random_uuid(),

  event_type text not null,

  aggregate_type text not null,
  aggregate_id text not null,

  status text not null default 'pending'
    check (
      status in (
        'pending',
        'processing',
        'completed',
        'failed',
        'dead_letter'
      )
    ),

  payload jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,

  attempts integer not null default 0,
  max_attempts integer not null default 5,

  available_at timestamptz not null default now(),
  locked_at timestamptz,
  locked_by text,

  last_error text,

  created_at timestamptz not null default now(),
  processed_at timestamptz
);

create index if not exists idx_domain_events_pending
  on public.domain_events(status, available_at);

create index if not exists idx_domain_events_aggregate
  on public.domain_events(
    aggregate_type,
    aggregate_id,
    created_at desc
  );

create table if not exists public.event_deliveries (
  id uuid primary key default gen_random_uuid(),

  event_id uuid not null
    references public.domain_events(id)
    on delete cascade,

  handler_name text not null,

  status text not null
    check (
      status in (
        'started',
        'completed',
        'failed'
      )
    ),

  started_at timestamptz not null default now(),
  completed_at timestamptz,
  error_message text,

  unique(event_id, handler_name)
);

alter table public.domain_events
  enable row level security;

alter table public.event_deliveries
  enable row level security;

commit;
