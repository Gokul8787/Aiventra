begin;

alter table if exists public.product_decisions
  add column if not exists readiness text not null default 'NOT_READY'
    check (readiness in ('READY', 'NOT_READY')),
  add column if not exists readiness_blocking_reasons text[] not null default '{}';

create table if not exists public.evidence_sources (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  store_id uuid not null references public.stores(id) on delete cascade,
  provider text not null,
  category text not null,
  name text not null,
  version text not null,
  enabled boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organisation_id, store_id, provider, category)
);

create table if not exists public.evidence_records (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  store_id uuid not null references public.stores(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  scan_id uuid references public.product_scans(id) on delete set null,
  product_key text,
  provider text not null,
  category text not null,
  verified boolean not null default false,
  confidence numeric(6,2) not null default 0,
  quality numeric(6,2) not null default 0,
  retrieved_at timestamptz not null,
  expires_at timestamptz,
  cost numeric(12,6) not null default 0,
  latency_ms integer not null default 0,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.evidence_cache (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  store_id uuid not null references public.stores(id) on delete cascade,
  cache_key text not null,
  provider text not null,
  category text not null,
  evidence jsonb not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organisation_id, store_id, cache_key)
);

create table if not exists public.provider_health (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  store_id uuid not null references public.stores(id) on delete cascade,
  provider text not null,
  category text not null,
  status text not null default 'healthy'
    check (status in ('healthy', 'degraded', 'failed', 'quota_low')),
  last_success_at timestamptz,
  last_failure_at timestamptz,
  latency_ms integer not null default 0,
  cost numeric(12,6) not null default 0,
  quota_remaining numeric(8,2),
  version text not null,
  metadata jsonb not null default '{}'::jsonb,
  checked_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organisation_id, store_id, provider, category)
);

create index if not exists idx_evidence_records_product
  on public.evidence_records(
    organisation_id,
    store_id,
    product_id,
    retrieved_at desc
  );

create index if not exists idx_evidence_records_scan
  on public.evidence_records(
    organisation_id,
    store_id,
    scan_id,
    category
  );

create index if not exists idx_evidence_cache_expiry
  on public.evidence_cache(
    organisation_id,
    store_id,
    expires_at
  );

create index if not exists idx_provider_health_tenant
  on public.provider_health(
    organisation_id,
    store_id,
    status,
    checked_at desc
  );

alter table public.evidence_sources enable row level security;
alter table public.evidence_records enable row level security;
alter table public.evidence_cache enable row level security;
alter table public.provider_health enable row level security;

drop policy if exists "Members read tenant evidence sources" on public.evidence_sources;
create policy "Members read tenant evidence sources"
on public.evidence_sources for select to authenticated
using (public.is_organisation_member(organisation_id) and public.can_access_store(store_id));

drop policy if exists "Members read tenant evidence records" on public.evidence_records;
create policy "Members read tenant evidence records"
on public.evidence_records for select to authenticated
using (public.is_organisation_member(organisation_id) and public.can_access_store(store_id));

drop policy if exists "Members read tenant evidence cache" on public.evidence_cache;
create policy "Members read tenant evidence cache"
on public.evidence_cache for select to authenticated
using (public.is_organisation_member(organisation_id) and public.can_access_store(store_id));

drop policy if exists "Members read tenant provider health" on public.provider_health;
create policy "Members read tenant provider health"
on public.provider_health for select to authenticated
using (public.is_organisation_member(organisation_id) and public.can_access_store(store_id));

commit;
