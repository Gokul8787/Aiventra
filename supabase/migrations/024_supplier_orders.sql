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
      'stale_job_recovery',
      'product_publication',
      'marketing_generation',
      'order_fulfilment',
      'tracking_sync'
    )
  );

alter table public.orders
  drop constraint if exists orders_status_check;

alter table public.orders
  add constraint orders_status_check
  check (
    status in (
      'received',
      'validated',
      'awaiting_fulfilment',
      'awaiting_fulfilment_approval',
      'manual_review',
      'blocked',
      'fulfilled',
      'cancelled',
      'refunded'
    )
  );

create table if not exists public.supplier_orders (
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

  supplier_account_id uuid not null
    references public.supplier_accounts(id)
    on delete restrict,

  provider text not null,
  external_order_id text,
  client_order_reference text not null,

  status text not null default 'PENDING'
    check (
      status in (
        'PENDING',
        'SUBMITTING',
        'CREATED',
        'AWAITING_PAYMENT',
        'PAID',
        'PROCESSING',
        'SHIPPED',
        'DELIVERED',
        'CANCEL_REQUESTED',
        'CANCELLED',
        'FAILED',
        'REVIEW_REQUIRED'
      )
    ),

  payment_status text not null default 'UNPAID'
    check (
      payment_status in (
        'UNPAID',
        'AWAITING_PAYMENT',
        'PAID',
        'FAILED',
        'REFUNDED',
        'NOT_REQUIRED'
      )
    ),

  currency text not null default 'GBP',
  product_cost numeric(12,2) not null default 0,
  shipping_cost numeric(12,2) not null default 0,
  total_cost numeric(12,2) not null default 0,

  shipping_method text,
  tracking_number text,
  tracking_url text,

  idempotency_key text not null,
  request_payload jsonb not null default '{}'::jsonb,
  response_payload jsonb not null default '{}'::jsonb,
  attempt_count integer not null default 0,
  last_error text,

  created_at timestamptz not null default now(),
  submitted_at timestamptz,
  paid_at timestamptz,
  shipped_at timestamptz,
  cancelled_at timestamptz,
  updated_at timestamptz not null default now(),

  unique (store_id, order_id, supplier_account_id),
  unique (idempotency_key)
);

create table if not exists public.supplier_order_items (
  id uuid primary key default gen_random_uuid(),

  organisation_id uuid not null
    references public.organisations(id)
    on delete cascade,

  store_id uuid not null
    references public.stores(id)
    on delete cascade,

  supplier_order_id uuid not null
    references public.supplier_orders(id)
    on delete cascade,

  order_item_id uuid not null
    references public.order_items(id)
    on delete cascade,

  product_id uuid
    references public.products(id)
    on delete set null,

  supplier_product_mapping_id uuid
    references public.supplier_product_mappings(id)
    on delete set null,

  supplier_product_id text not null,
  supplier_variant_id text,
  supplier_sku text,
  warehouse_id text,

  title text not null,
  quantity integer not null default 1,
  unit_cost numeric(12,2) not null default 0,
  shipping_cost numeric(12,2) not null default 0,
  total_cost numeric(12,2) not null default 0,

  request_payload jsonb not null default '{}'::jsonb,
  response_payload jsonb not null default '{}'::jsonb,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (supplier_order_id, order_item_id)
);

create table if not exists public.supplier_order_events (
  id uuid primary key default gen_random_uuid(),

  organisation_id uuid not null
    references public.organisations(id)
    on delete cascade,

  store_id uuid not null
    references public.stores(id)
    on delete cascade,

  supplier_order_id uuid not null
    references public.supplier_orders(id)
    on delete cascade,

  event_type text not null,
  message text,
  payload jsonb not null default '{}'::jsonb,
  created_by text not null default 'system',
  created_at timestamptz not null default now()
);

create table if not exists public.fulfilment_failures (
  id uuid primary key default gen_random_uuid(),

  organisation_id uuid not null
    references public.organisations(id)
    on delete cascade,

  store_id uuid not null
    references public.stores(id)
    on delete cascade,

  order_id uuid
    references public.orders(id)
    on delete cascade,

  order_item_id uuid
    references public.order_items(id)
    on delete set null,

  supplier_order_id uuid
    references public.supplier_orders(id)
    on delete set null,

  provider text,
  failure_type text not null,
  severity text not null default 'review'
    check (severity in ('info', 'review', 'blocked', 'critical')),
  message text not null,
  retryable boolean not null default false,
  resolved boolean not null default false,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

create index if not exists idx_supplier_orders_order
  on public.supplier_orders(order_id, status);

create index if not exists idx_supplier_orders_external
  on public.supplier_orders(provider, external_order_id)
  where external_order_id is not null;

create index if not exists idx_supplier_orders_tenant_status
  on public.supplier_orders(organisation_id, store_id, status, created_at desc);

create index if not exists idx_supplier_order_items_order
  on public.supplier_order_items(supplier_order_id);

create index if not exists idx_supplier_order_events_order
  on public.supplier_order_events(supplier_order_id, created_at desc);

create index if not exists idx_fulfilment_failures_order
  on public.fulfilment_failures(order_id, resolved, created_at desc);

alter table public.supplier_orders enable row level security;
alter table public.supplier_order_items enable row level security;
alter table public.supplier_order_events enable row level security;
alter table public.fulfilment_failures enable row level security;

drop policy if exists "Members read tenant supplier orders" on public.supplier_orders;
create policy "Members read tenant supplier orders"
on public.supplier_orders for select to authenticated
using (public.is_organisation_member(organisation_id) and public.can_access_store(store_id));

drop policy if exists "Members read tenant supplier order items" on public.supplier_order_items;
create policy "Members read tenant supplier order items"
on public.supplier_order_items for select to authenticated
using (public.is_organisation_member(organisation_id) and public.can_access_store(store_id));

drop policy if exists "Members read tenant supplier order events" on public.supplier_order_events;
create policy "Members read tenant supplier order events"
on public.supplier_order_events for select to authenticated
using (public.is_organisation_member(organisation_id) and public.can_access_store(store_id));

drop policy if exists "Members read tenant fulfilment failures" on public.fulfilment_failures;
create policy "Members read tenant fulfilment failures"
on public.fulfilment_failures for select to authenticated
using (public.is_organisation_member(organisation_id) and public.can_access_store(store_id));

commit;
