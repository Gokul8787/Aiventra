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
      'tracking_sync'
    )
  );

create table if not exists public.platform_fulfilments (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null
    references public.organisations(id)
    on delete cascade,
  store_id uuid not null
    references public.stores(id)
    on delete cascade,
  order_id uuid not null
    references public.orders(id)
    on delete cascade,
  shipment_tracking_id uuid not null
    references public.shipment_tracking(id)
    on delete cascade,
  supplier_order_id uuid
    references public.supplier_orders(id)
    on delete set null,
  platform text not null,
  external_fulfilment_id text,
  external_order_id text,
  external_fulfilment_order_ids text[] not null default '{}'::text[],
  tracking_number text,
  tracking_url text,
  carrier text,
  status text not null default 'pending'
    check (status in ('pending', 'submitted', 'fulfilled', 'failed', 'cancelled')),
  customer_notified boolean not null default false,
  error_message text,
  raw_response jsonb not null default '{}'::jsonb,
  fulfilled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (store_id, platform, shipment_tracking_id)
);

create unique index if not exists idx_platform_fulfilments_external
  on public.platform_fulfilments(store_id, platform, external_fulfilment_id)
  where external_fulfilment_id is not null;

create table if not exists public.platform_fulfilment_events (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null
    references public.organisations(id)
    on delete cascade,
  store_id uuid not null
    references public.stores(id)
    on delete cascade,
  platform_fulfilment_id uuid not null
    references public.platform_fulfilments(id)
    on delete cascade,
  dedupe_key text not null,
  event_type text not null,
  status text,
  message text,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (store_id, dedupe_key)
);

create index if not exists idx_platform_fulfilments_order
  on public.platform_fulfilments(order_id, created_at desc);

create index if not exists idx_platform_fulfilments_platform
  on public.platform_fulfilments(platform, status, created_at desc);

create index if not exists idx_platform_fulfilment_events_fulfilment
  on public.platform_fulfilment_events(platform_fulfilment_id, created_at desc);

alter table public.platform_fulfilments enable row level security;
alter table public.platform_fulfilment_events enable row level security;

drop policy if exists "Members read tenant platform fulfilments" on public.platform_fulfilments;
create policy "Members read tenant platform fulfilments"
on public.platform_fulfilments for select to authenticated
using (public.is_organisation_member(organisation_id) and public.can_access_store(store_id));

drop policy if exists "Members read tenant platform fulfilment events" on public.platform_fulfilment_events;
create policy "Members read tenant platform fulfilment events"
on public.platform_fulfilment_events for select to authenticated
using (public.is_organisation_member(organisation_id) and public.can_access_store(store_id));

commit;
