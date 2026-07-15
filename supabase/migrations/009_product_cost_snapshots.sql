begin;

create table if not exists public.product_cost_snapshots (
  id uuid primary key default gen_random_uuid(),

  scan_id uuid references public.product_scans(id)
    on delete cascade,

  product_id uuid not null
    references public.products(id)
    on delete cascade,

  calculation_type text not null
    check (
      calculation_type in (
        'estimated',
        'actual',
        'forecast'
      )
    ),

  currency text not null,

  revenue numeric(12,2) not null,

  supplier_cost numeric(12,2) not null,
  shipping_cost numeric(12,2) not null,
  payment_fee numeric(12,2) not null,
  platform_fee_allocation numeric(12,2) not null,
  advertising_cost numeric(12,2) not null,
  return_allowance numeric(12,2) not null,
  currency_conversion_fee numeric(12,2) not null,
  vat_reserve numeric(12,2) not null,
  other_costs numeric(12,2) not null,

  total_non_advertising_cost numeric(12,2) not null,
  total_cost numeric(12,2) not null,

  gross_profit numeric(12,2) not null,
  pre_advertising_profit numeric(12,2) not null,
  net_profit numeric(12,2) not null,

  gross_margin_percent numeric(8,2) not null,
  net_margin_percent numeric(8,2) not null,
  roi_percent numeric(8,2) not null,
  break_even_roas numeric(8,2) not null,
  maximum_affordable_cpa numeric(12,2) not null,

  profit_score numeric(5,2) not null,
  financially_viable boolean not null,

  engine_version text not null,
  analysis jsonb not null default '{}'::jsonb,

  calculated_at timestamptz not null default now()
);

create index if not exists idx_cost_snapshots_product
  on public.product_cost_snapshots(
    product_id,
    calculated_at desc
  );

create index if not exists idx_cost_snapshots_scan
  on public.product_cost_snapshots(scan_id);

create index if not exists idx_cost_snapshots_viability
  on public.product_cost_snapshots(
    financially_viable,
    net_margin_percent desc
  );

alter table public.product_cost_snapshots
  enable row level security;

commit;
