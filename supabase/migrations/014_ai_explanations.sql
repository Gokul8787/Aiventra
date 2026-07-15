begin;

create table if not exists public.ai_explanations (
  id uuid primary key default gen_random_uuid(),

  organisation_id uuid not null
    references public.organisations(id)
    on delete cascade,

  store_id uuid not null
    references public.stores(id)
    on delete cascade,

  scan_id uuid not null
    references public.product_scans(id)
    on delete cascade,

  product_id uuid not null
    references public.products(id)
    on delete cascade,

  decision text not null,
  final_score numeric(6,2) not null default 0,
  confidence numeric(6,2) not null default 0,
  summary text not null,
  items jsonb not null default '[]'::jsonb,
  explanation jsonb not null default '{}'::jsonb,
  version text not null,
  generated_at timestamptz not null default now(),

  unique (scan_id, product_id)
);

create index if not exists idx_ai_explanations_product
  on public.ai_explanations(
    organisation_id,
    store_id,
    product_id,
    generated_at desc
  );

create index if not exists idx_ai_explanations_decision
  on public.ai_explanations(
    organisation_id,
    store_id,
    decision,
    generated_at desc
  );

alter table public.ai_explanations enable row level security;

commit;
