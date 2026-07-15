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
      'stale_job_recovery',
      'product_publication',
      'marketing_generation',
      'order_fulfilment',
      'tracking_sync'
    )
  );

create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  store_id uuid not null references public.stores(id) on delete cascade,
  shopify_customer_id text,
  email text,
  first_name text,
  last_name text,
  phone text,
  address jsonb not null default '{}'::jsonb,
  raw_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organisation_id, store_id, shopify_customer_id)
);

create unique index if not exists idx_customers_tenant_email
  on public.customers(organisation_id, store_id, lower(email))
  where email is not null
    and shopify_customer_id is null;

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  store_id uuid not null references public.stores(id) on delete cascade,
  customer_id uuid references public.customers(id) on delete set null,
  shopify_order_id text not null,
  shopify_admin_graphql_api_id text,
  shopify_order_name text,
  order_number text,
  status text not null check (
    status in (
      'received',
      'validated',
      'awaiting_fulfilment',
      'manual_review',
      'blocked',
      'fulfilled',
      'cancelled',
      'refunded'
    )
  ),
  financial_status text,
  fulfilment_status text,
  currency text not null default 'GBP',
  subtotal numeric(12,2) not null default 0,
  shipping numeric(12,2) not null default 0,
  tax numeric(12,2) not null default 0,
  discount numeric(12,2) not null default 0,
  total numeric(12,2) not null default 0,
  validation_status text not null default 'pending' check (
    validation_status in ('pending', 'ready', 'review', 'blocked')
  ),
  validation_decision jsonb,
  placed_at timestamptz,
  cancelled_at timestamptz,
  refunded_at timestamptz,
  raw_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organisation_id, store_id, shopify_order_id)
);

create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  store_id uuid not null references public.stores(id) on delete cascade,
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  shopify_line_item_id text not null,
  shopify_product_id text,
  shopify_variant_id text,
  title text not null,
  sku text,
  quantity integer not null default 1,
  price numeric(12,2) not null default 0,
  cost numeric(12,2),
  profit numeric(12,2),
  supplier_id text,
  supplier_product_id text,
  fulfilment_status text not null default 'pending' check (
    fulfilment_status in (
      'pending',
      'ready',
      'manual_review',
      'supplier_pending',
      'supplier_ordered',
      'fulfilled',
      'cancelled',
      'refunded'
    )
  ),
  raw_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organisation_id, store_id, shopify_line_item_id)
);

create table if not exists public.webhook_events (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid references public.organisations(id) on delete cascade,
  store_id uuid references public.stores(id) on delete cascade,
  provider text not null,
  event text not null,
  external_id text not null,
  event_id text,
  shop_domain text,
  payload jsonb not null default '{}'::jsonb,
  processed boolean not null default false,
  processed_at timestamptz,
  error_message text,
  received_at timestamptz not null default now(),
  unique (provider, event, external_id)
);

create table if not exists public.order_validations (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  store_id uuid not null references public.stores(id) on delete cascade,
  order_id uuid not null references public.orders(id) on delete cascade,
  job_id uuid references public.ai_jobs(id) on delete set null,
  decision text not null check (
    decision in ('AUTO_FULFIL', 'MANUAL_REVIEW', 'BLOCKED')
  ),
  confidence integer not null default 0 check (confidence between 0 and 100),
  reasons text[] not null default '{}',
  blockers text[] not null default '{}',
  checks jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table if exists public.product_publications
  add column if not exists shopify_variant_id text;

create index if not exists idx_orders_tenant_status
  on public.orders(organisation_id, store_id, status, created_at desc);

create index if not exists idx_orders_tenant_validation
  on public.orders(organisation_id, store_id, validation_status, created_at desc);

create index if not exists idx_order_items_order
  on public.order_items(order_id);

create index if not exists idx_order_items_product
  on public.order_items(product_id)
  where product_id is not null;

create index if not exists idx_webhook_events_tenant_received
  on public.webhook_events(organisation_id, store_id, received_at desc);

create index if not exists idx_order_validations_order
  on public.order_validations(order_id, created_at desc);

alter table public.customers enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.webhook_events enable row level security;
alter table public.order_validations enable row level security;

drop policy if exists "Members read tenant customers" on public.customers;
create policy "Members read tenant customers"
on public.customers for select to authenticated
using (public.is_organisation_member(organisation_id) and public.can_access_store(store_id));

drop policy if exists "Members read tenant orders" on public.orders;
create policy "Members read tenant orders"
on public.orders for select to authenticated
using (public.is_organisation_member(organisation_id) and public.can_access_store(store_id));

drop policy if exists "Members read tenant order items" on public.order_items;
create policy "Members read tenant order items"
on public.order_items for select to authenticated
using (public.is_organisation_member(organisation_id) and public.can_access_store(store_id));

drop policy if exists "Members read tenant webhook events" on public.webhook_events;
create policy "Members read tenant webhook events"
on public.webhook_events for select to authenticated
using (public.is_organisation_member(organisation_id) and public.can_access_store(store_id));

drop policy if exists "Members read tenant order validations" on public.order_validations;
create policy "Members read tenant order validations"
on public.order_validations for select to authenticated
using (public.is_organisation_member(organisation_id) and public.can_access_store(store_id));

commit;
