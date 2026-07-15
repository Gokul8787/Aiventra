begin;

create table if not exists public.supplier_snapshots (
  id uuid primary key default gen_random_uuid(),

  scan_id uuid references public.product_scans(id)
    on delete cascade,

  product_id uuid not null
    references public.products(id)
    on delete cascade,

  provider text not null,
  supplier_id text not null,
  external_product_id text not null,

  supplier_price numeric(12,2),
  stock integer,
  quoted_delivery_days integer,
  shipping_cost numeric(12,2),

  actual_delivery_days integer,
  order_accurate boolean,
  refunded boolean,
  supplier_response_hours numeric(10,2),

  observed_at timestamptz not null,
  created_at timestamptz not null default now()
);

create table if not exists public.supplier_reliability_snapshots (
  id uuid primary key default gen_random_uuid(),

  scan_id uuid references public.product_scans(id)
    on delete cascade,

  product_id uuid not null
    references public.products(id)
    on delete cascade,

  supplier_score numeric(5,2) not null,
  supplier_risk text not null
    check (supplier_risk in ('low', 'medium', 'high')),

  preferred_supplier boolean not null default false,
  data_quality text not null
    check (
      data_quality in (
        'estimated',
        'mixed',
        'verified'
      )
    ),

  sample_size integer not null default 0,
  reasons jsonb not null default '[]'::jsonb,
  warnings jsonb not null default '[]'::jsonb,
  missing_evidence jsonb not null default '[]'::jsonb,

  metrics jsonb not null default '{}'::jsonb,
  analysis jsonb not null default '{}'::jsonb,

  engine_version text not null,
  calculated_at timestamptz not null default now()
);

create index if not exists idx_supplier_snapshots_product
  on public.supplier_snapshots(
    product_id,
    observed_at desc
  );

create index if not exists idx_supplier_snapshots_supplier
  on public.supplier_snapshots(
    provider,
    supplier_id,
    observed_at desc
  );

create index if not exists idx_supplier_reliability_product
  on public.supplier_reliability_snapshots(
    product_id,
    calculated_at desc
  );

create index if not exists idx_supplier_reliability_score
  on public.supplier_reliability_snapshots(
    supplier_score desc
  );

alter table public.supplier_snapshots
  enable row level security;

alter table public.supplier_reliability_snapshots
  enable row level security;

commit;
