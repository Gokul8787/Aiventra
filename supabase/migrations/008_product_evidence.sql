begin;

create table if not exists public.product_evidence (
  id uuid primary key default gen_random_uuid(),

  scan_id uuid not null
    references public.product_scans(id)
    on delete cascade,

  product_id uuid not null
    references public.products(id)
    on delete cascade,

  source text not null,
  metric text not null,

  value numeric,
  normalized_score numeric(5,2),

  reliability numeric(5,2) not null,
  freshness numeric(5,2) not null,
  completeness numeric(5,2) not null,

  verified boolean not null default false,
  metadata jsonb not null default '{}'::jsonb,

  observed_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_product_evidence_product
  on public.product_evidence(product_id, observed_at desc);

create index if not exists idx_product_evidence_scan
  on public.product_evidence(scan_id);

create index if not exists idx_product_evidence_metric
  on public.product_evidence(metric, source);

alter table public.product_evidence
  enable row level security;

commit;
