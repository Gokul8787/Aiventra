begin;

create extension if not exists pgcrypto;

create table if not exists public.organisations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  country text not null,
  currency text not null,
  timezone text not null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.stores (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid references public.organisations(id) on delete cascade,
  name text not null,
  platform text not null,
  shopify_domain text,
  currency text,
  country text,
  timezone text,
  active boolean default true,
  created_at timestamptz not null default now()
);

alter table if exists public.stores
  add column if not exists organisation_id uuid,
  add column if not exists shopify_domain text,
  add column if not exists currency text,
  add column if not exists country text,
  add column if not exists timezone text,
  add column if not exists active boolean default true;

insert into public.organisations (
  id,
  name,
  slug,
  country,
  currency,
  timezone
)
values (
  '00000000-0000-4000-8000-000000000001',
  'Aiventra Demo',
  'aiventra-demo',
  'GB',
  'GBP',
  'Europe/London'
)
on conflict (slug) do nothing;

insert into public.stores (
  id,
  organisation_id,
  name,
  platform,
  domain,
  shopify_domain,
  currency_code,
  currency,
  country,
  timezone,
  active,
  connection_status
)
values (
  '00000000-0000-4000-8000-000000000002',
  '00000000-0000-4000-8000-000000000001',
  'Aiventra Shopify',
  'shopify',
  'aiventra-demo.myshopify.com',
  'aiventra-demo.myshopify.com',
  'GBP',
  'GBP',
  'GB',
  'Europe/London',
  true,
  'connected'
)
on conflict (platform, domain) do update
set
  organisation_id = excluded.organisation_id,
  shopify_domain = coalesce(public.stores.shopify_domain, excluded.shopify_domain),
  currency = coalesce(public.stores.currency, excluded.currency),
  country = coalesce(public.stores.country, excluded.country),
  timezone = coalesce(public.stores.timezone, excluded.timezone),
  active = coalesce(public.stores.active, excluded.active);

update public.stores
set
  organisation_id = coalesce(organisation_id, '00000000-0000-4000-8000-000000000001'),
  shopify_domain = coalesce(shopify_domain, domain),
  currency = coalesce(currency, currency_code, 'GBP'),
  country = coalesce(country, 'GB'),
  timezone = coalesce(timezone, 'Europe/London'),
  active = coalesce(active, true)
where organisation_id is null
  or shopify_domain is null
  or currency is null
  or country is null
  or timezone is null
  or active is null;

alter table if exists public.ai_jobs
  add column if not exists organisation_id uuid,
  add column if not exists store_id uuid;

alter table if exists public.product_scans
  add column if not exists organisation_id uuid,
  add column if not exists store_id uuid;

alter table if exists public.provider_runs
  add column if not exists organisation_id uuid,
  add column if not exists store_id uuid;

alter table if exists public.products
  add column if not exists organisation_id uuid,
  add column if not exists store_id uuid;

alter table if exists public.scan_products
  add column if not exists organisation_id uuid,
  add column if not exists store_id uuid;

alter table if exists public.product_intelligence
  add column if not exists organisation_id uuid,
  add column if not exists store_id uuid;

alter table if exists public.publishing_packages
  add column if not exists organisation_id uuid,
  add column if not exists store_id uuid;

alter table if exists public.product_publications
  add column if not exists organisation_id uuid;

alter table if exists public.product_decisions
  add column if not exists organisation_id uuid,
  add column if not exists store_id uuid;

alter table if exists public.product_lifecycle
  add column if not exists organisation_id uuid,
  add column if not exists store_id uuid;

alter table if exists public.domain_events
  add column if not exists organisation_id uuid,
  add column if not exists store_id uuid;

alter table if exists public.event_deliveries
  add column if not exists organisation_id uuid,
  add column if not exists store_id uuid;

alter table if exists public.job_attempts
  add column if not exists organisation_id uuid,
  add column if not exists store_id uuid;

alter table if exists public.job_logs
  add column if not exists organisation_id uuid,
  add column if not exists store_id uuid;

alter table if exists public.ai_prompts
  add column if not exists organisation_id uuid,
  add column if not exists store_id uuid;

alter table if exists public.ai_responses
  add column if not exists organisation_id uuid,
  add column if not exists store_id uuid;

alter table if exists public.product_evidence
  add column if not exists organisation_id uuid,
  add column if not exists store_id uuid;

alter table if exists public.product_cost_snapshots
  add column if not exists organisation_id uuid,
  add column if not exists store_id uuid;

alter table if exists public.supplier_snapshots
  add column if not exists organisation_id uuid,
  add column if not exists store_id uuid;

alter table if exists public.supplier_reliability_snapshots
  add column if not exists organisation_id uuid,
  add column if not exists store_id uuid;

update public.ai_jobs
set
  organisation_id = coalesce(organisation_id, '00000000-0000-4000-8000-000000000001'),
  store_id = coalesce(store_id, '00000000-0000-4000-8000-000000000002')
where organisation_id is null or store_id is null;

update public.product_scans
set
  organisation_id = coalesce(organisation_id, '00000000-0000-4000-8000-000000000001'),
  store_id = coalesce(store_id, '00000000-0000-4000-8000-000000000002')
where organisation_id is null or store_id is null;

update public.provider_runs
set
  organisation_id = coalesce(organisation_id, '00000000-0000-4000-8000-000000000001'),
  store_id = coalesce(store_id, '00000000-0000-4000-8000-000000000002')
where organisation_id is null or store_id is null;

update public.products
set
  organisation_id = coalesce(organisation_id, '00000000-0000-4000-8000-000000000001'),
  store_id = coalesce(store_id, '00000000-0000-4000-8000-000000000002')
where organisation_id is null or store_id is null;

update public.scan_products
set
  organisation_id = coalesce(organisation_id, '00000000-0000-4000-8000-000000000001'),
  store_id = coalesce(store_id, '00000000-0000-4000-8000-000000000002')
where organisation_id is null or store_id is null;

update public.product_intelligence
set
  organisation_id = coalesce(organisation_id, '00000000-0000-4000-8000-000000000001'),
  store_id = coalesce(store_id, '00000000-0000-4000-8000-000000000002')
where organisation_id is null or store_id is null;

update public.publishing_packages
set
  organisation_id = coalesce(organisation_id, '00000000-0000-4000-8000-000000000001'),
  store_id = coalesce(store_id, '00000000-0000-4000-8000-000000000002')
where organisation_id is null or store_id is null;

update public.product_publications
set organisation_id = coalesce(organisation_id, '00000000-0000-4000-8000-000000000001')
where organisation_id is null;

update public.product_decisions
set
  organisation_id = coalesce(organisation_id, '00000000-0000-4000-8000-000000000001'),
  store_id = coalesce(store_id, '00000000-0000-4000-8000-000000000002')
where organisation_id is null or store_id is null;

update public.product_lifecycle
set
  organisation_id = coalesce(organisation_id, '00000000-0000-4000-8000-000000000001'),
  store_id = coalesce(store_id, '00000000-0000-4000-8000-000000000002')
where organisation_id is null or store_id is null;

update public.domain_events
set
  organisation_id = coalesce(organisation_id, '00000000-0000-4000-8000-000000000001'),
  store_id = coalesce(store_id, '00000000-0000-4000-8000-000000000002')
where organisation_id is null or store_id is null;

update public.event_deliveries
set
  organisation_id = coalesce(organisation_id, '00000000-0000-4000-8000-000000000001'),
  store_id = coalesce(store_id, '00000000-0000-4000-8000-000000000002')
where organisation_id is null or store_id is null;

update public.job_attempts
set
  organisation_id = coalesce(organisation_id, '00000000-0000-4000-8000-000000000001'),
  store_id = coalesce(store_id, '00000000-0000-4000-8000-000000000002')
where organisation_id is null or store_id is null;

update public.job_logs
set
  organisation_id = coalesce(organisation_id, '00000000-0000-4000-8000-000000000001'),
  store_id = coalesce(store_id, '00000000-0000-4000-8000-000000000002')
where organisation_id is null or store_id is null;

update public.ai_prompts
set
  organisation_id = coalesce(organisation_id, '00000000-0000-4000-8000-000000000001'),
  store_id = coalesce(store_id, '00000000-0000-4000-8000-000000000002')
where organisation_id is null or store_id is null;

update public.ai_responses
set
  organisation_id = coalesce(organisation_id, '00000000-0000-4000-8000-000000000001'),
  store_id = coalesce(store_id, '00000000-0000-4000-8000-000000000002')
where organisation_id is null or store_id is null;

update public.product_evidence
set
  organisation_id = coalesce(organisation_id, '00000000-0000-4000-8000-000000000001'),
  store_id = coalesce(store_id, '00000000-0000-4000-8000-000000000002')
where organisation_id is null or store_id is null;

update public.product_cost_snapshots
set
  organisation_id = coalesce(organisation_id, '00000000-0000-4000-8000-000000000001'),
  store_id = coalesce(store_id, '00000000-0000-4000-8000-000000000002')
where organisation_id is null or store_id is null;

update public.supplier_snapshots
set
  organisation_id = coalesce(organisation_id, '00000000-0000-4000-8000-000000000001'),
  store_id = coalesce(store_id, '00000000-0000-4000-8000-000000000002')
where organisation_id is null or store_id is null;

update public.supplier_reliability_snapshots
set
  organisation_id = coalesce(organisation_id, '00000000-0000-4000-8000-000000000001'),
  store_id = coalesce(store_id, '00000000-0000-4000-8000-000000000002')
where organisation_id is null or store_id is null;

alter table if exists public.products
  drop constraint if exists products_provider_external_product_id_key;

create unique index if not exists idx_products_tenant_provider_external
  on public.products(organisation_id, store_id, provider, external_product_id);

create index if not exists idx_ai_jobs_tenant_status
  on public.ai_jobs(organisation_id, store_id, status, created_at desc);

create index if not exists idx_product_scans_tenant_started
  on public.product_scans(organisation_id, store_id, started_at desc);

create index if not exists idx_products_tenant_last_seen
  on public.products(organisation_id, store_id, last_seen_at desc);

create index if not exists idx_domain_events_tenant_status
  on public.domain_events(organisation_id, store_id, status, available_at);

create index if not exists idx_ai_prompts_tenant_created
  on public.ai_prompts(organisation_id, store_id, created_at desc);

create index if not exists idx_ai_responses_tenant_created
  on public.ai_responses(organisation_id, store_id, created_at desc);

create index if not exists idx_product_lifecycle_tenant_product
  on public.product_lifecycle(organisation_id, store_id, product_id, changed_at desc);

create index if not exists idx_product_decisions_tenant_product
  on public.product_decisions(organisation_id, store_id, product_id, evaluated_at desc);

create index if not exists idx_product_evidence_tenant_product
  on public.product_evidence(organisation_id, store_id, product_id, observed_at desc);

create index if not exists idx_cost_snapshots_tenant_product
  on public.product_cost_snapshots(organisation_id, store_id, product_id, calculated_at desc);

create index if not exists idx_supplier_snapshots_tenant_supplier
  on public.supplier_snapshots(organisation_id, store_id, provider, supplier_id, observed_at desc);

create index if not exists idx_supplier_reliability_tenant_product
  on public.supplier_reliability_snapshots(organisation_id, store_id, product_id, calculated_at desc);

do $$
declare
  target_table text;
begin
  foreach target_table in array array[
    'stores',
    'ai_jobs',
    'product_scans',
    'provider_runs',
    'products',
    'scan_products',
    'product_intelligence',
    'publishing_packages',
    'product_publications',
    'product_decisions',
    'product_lifecycle',
    'domain_events',
    'event_deliveries',
    'job_attempts',
    'job_logs',
    'ai_prompts',
    'ai_responses',
    'product_evidence',
    'product_cost_snapshots',
    'supplier_snapshots',
    'supplier_reliability_snapshots'
  ]
  loop
    if exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = target_table
        and column_name = 'organisation_id'
    ) and not exists (
      select 1
      from pg_constraint
      where conname = target_table || '_organisation_id_fkey'
    ) then
      execute format(
        'alter table public.%I add constraint %I foreign key (organisation_id) references public.organisations(id) on delete cascade',
        target_table,
        target_table || '_organisation_id_fkey'
      );
    end if;

    if target_table <> 'organisations'
      and exists (
        select 1
        from information_schema.columns
        where table_schema = 'public'
          and table_name = target_table
          and column_name = 'store_id'
      )
      and not exists (
        select 1
        from pg_constraint
        where conname = target_table || '_store_id_fkey'
      ) then
      execute format(
        'alter table public.%I add constraint %I foreign key (store_id) references public.stores(id) on delete cascade',
        target_table,
        target_table || '_store_id_fkey'
      );
    end if;
  end loop;
end $$;

alter table public.organisations enable row level security;

commit;
