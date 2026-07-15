begin;

create table if not exists public.product_decisions (
  id uuid primary key default gen_random_uuid(),

  scan_id uuid not null
    references public.product_scans(id)
    on delete cascade,

  product_id uuid not null
    references public.products(id)
    on delete cascade,

  decision text not null
    check (
      decision in (
        'PUBLISH',
        'BUY',
        'WATCH',
        'REVIEW',
        'IGNORE'
      )
    ),

  confidence numeric(5,2) not null,
  risk text not null
    check (risk in ('low', 'medium', 'high')),

  automation_allowed boolean not null default false,
  requires_human_approval boolean not null default true,

  reasons jsonb not null default '[]'::jsonb,
  blockers text[] not null default '{}',
  warnings text[] not null default '{}',

  engine_version text not null,
  evaluated_at timestamptz not null default now(),

  unique (scan_id, product_id)
);

create index if not exists idx_product_decisions_decision
  on public.product_decisions(decision);

create index if not exists idx_product_decisions_automation
  on public.product_decisions(
    automation_allowed,
    evaluated_at desc
  );

create index if not exists idx_product_decisions_product
  on public.product_decisions(
    product_id,
    evaluated_at desc
  );

alter table public.product_decisions
  enable row level security;

commit;
