begin;

create table if not exists public.supplier_accounts (
  id uuid primary key default gen_random_uuid(),

  organisation_id uuid not null
    references public.organisations(id)
    on delete cascade,

  store_id uuid not null
    references public.stores(id)
    on delete cascade,

  provider text not null,
  name text not null,

  status text not null default 'active'
    check (
      status in (
        'active',
        'disabled',
        'error'
      )
    ),

  priority integer not null default 100,

  capabilities text[] not null default '{}',

  configuration jsonb not null default '{}'::jsonb,

  last_connected_at timestamptz,
  last_error text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (
    organisation_id,
    store_id,
    provider,
    name
  )
);

create table if not exists public.supplier_product_mappings (
  id uuid primary key default gen_random_uuid(),

  organisation_id uuid not null
    references public.organisations(id)
    on delete cascade,

  store_id uuid not null
    references public.stores(id)
    on delete cascade,

  product_id uuid not null
    references public.products(id)
    on delete cascade,

  supplier_account_id uuid not null
    references public.supplier_accounts(id)
    on delete cascade,

  supplier_product_id text not null,
  supplier_variant_id text,

  supplier_sku text,

  warehouse_id text,
  shipping_method_id text,

  active boolean not null default true,
  preferred boolean not null default false,

  last_verified_at timestamptz,

  metadata jsonb not null default '{}'::jsonb,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (
    store_id,
    product_id,
    supplier_account_id,
    supplier_product_id,
    supplier_variant_id
  )
);

create table if not exists public.fulfilment_checks (
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

  order_item_id uuid not null
    references public.order_items(id)
    on delete cascade,

  supplier_account_id uuid
    references public.supplier_accounts(id)
    on delete set null,

  supplier_product_mapping_id uuid
    references public.supplier_product_mappings(id)
    on delete set null,

  status text not null
    check (
      status in (
        'pending',
        'checking',
        'passed',
        'review',
        'blocked',
        'failed'
      )
    ),

  inventory_available boolean,
  available_quantity integer,

  latest_unit_cost numeric(12,2),
  original_unit_cost numeric(12,2),
  cost_change_percent numeric(8,2),

  shipping_cost numeric(12,2),
  delivery_days_min integer,
  delivery_days_max integer,
  shipping_method text,

  estimated_net_profit numeric(12,2),
  estimated_net_margin_percent numeric(8,2),

  decision text
    check (
      decision in (
        'AUTO_FULFIL',
        'MANUAL_REVIEW',
        'BLOCKED'
      )
    ),

  blockers text[] not null default '{}',
  warnings text[] not null default '{}',
  reasons text[] not null default '{}',

  raw_evidence jsonb not null default '{}'::jsonb,

  checked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (order_item_id)
);

create index if not exists idx_supplier_accounts_store
  on public.supplier_accounts(
    organisation_id,
    store_id,
    status,
    priority
  );

create index if not exists idx_supplier_mappings_product
  on public.supplier_product_mappings(
    store_id,
    product_id,
    active,
    preferred
  );

create index if not exists idx_fulfilment_checks_order
  on public.fulfilment_checks(
    order_id,
    status
  );

alter table public.supplier_accounts
  enable row level security;

alter table public.supplier_product_mappings
  enable row level security;

alter table public.fulfilment_checks
  enable row level security;

commit;
