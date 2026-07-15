begin;

create table if not exists public.product_memory (
  id uuid primary key default gen_random_uuid(),

  organisation_id uuid not null
    references public.organisations(id)
    on delete cascade,

  store_id uuid not null
    references public.stores(id)
    on delete cascade,

  product_key text not null,
  provider text not null,

  first_seen timestamptz not null,
  last_seen timestamptz not null,

  times_seen integer not null default 0,
  times_recommended integer not null default 0,
  times_published integer not null default 0,
  times_sold integer not null default 0,
  times_retired integer not null default 0,

  highest_ai_score numeric(6,2) not null default 0,
  lowest_ai_score numeric(6,2) not null default 0,
  average_ai_score numeric(6,2) not null default 0,

  current_supplier text not null,
  supplier_changes integer not null default 0,

  current_price numeric(12,2) not null default 0,
  lowest_price numeric(12,2) not null default 0,
  highest_price numeric(12,2) not null default 0,

  trend_history numeric[] not null default '{}',
  confidence_history numeric[] not null default '{}',
  current_confidence numeric(6,2) not null default 0,
  decision_history text[] not null default '{}',

  notes text[] not null default '{}',

  memory jsonb not null default '{}'::jsonb,
  version text not null,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (organisation_id, store_id, product_key)
);

create table if not exists public.product_memory_events (
  id uuid primary key default gen_random_uuid(),

  organisation_id uuid not null
    references public.organisations(id)
    on delete cascade,

  store_id uuid not null
    references public.stores(id)
    on delete cascade,

  product_key text not null,
  product_id uuid
    references public.products(id)
    on delete set null,

  scan_id uuid
    references public.product_scans(id)
    on delete set null,

  event_type text not null,
  previous_value jsonb,
  value jsonb,
  metadata jsonb not null default '{}'::jsonb,

  occurred_at timestamptz not null,
  created_at timestamptz not null default now()
);

create table if not exists public.product_memory_versions (
  id uuid primary key default gen_random_uuid(),

  organisation_id uuid not null
    references public.organisations(id)
    on delete cascade,

  store_id uuid not null
    references public.stores(id)
    on delete cascade,

  product_key text not null,
  product_id uuid
    references public.products(id)
    on delete set null,

  scan_id uuid
    references public.product_scans(id)
    on delete set null,

  memory jsonb not null,
  version text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_product_memory_tenant_seen
  on public.product_memory(
    organisation_id,
    store_id,
    times_seen desc,
    last_seen desc
  );

create index if not exists idx_product_memory_tenant_confidence
  on public.product_memory(
    organisation_id,
    store_id,
    current_confidence desc,
    last_seen desc
  );

create index if not exists idx_product_memory_events_product
  on public.product_memory_events(
    organisation_id,
    store_id,
    product_key,
    occurred_at desc
  );

create index if not exists idx_product_memory_versions_product
  on public.product_memory_versions(
    organisation_id,
    store_id,
    product_key,
    created_at desc
  );

alter table public.product_memory enable row level security;
alter table public.product_memory_events enable row level security;
alter table public.product_memory_versions enable row level security;

commit;
