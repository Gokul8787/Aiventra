begin;

alter table public.products
  add column if not exists current_lifecycle text not null default 'DISCOVERED'
    check (
      current_lifecycle in (
        'DISCOVERED',
        'ANALYSED',
        'AI_APPROVED',
        'LISTING_GENERATED',
        'DRAFT_CREATED',
        'PUBLISHED',
        'ADVERTISING',
        'SELLING',
        'SCALING',
        'RETIRED'
      )
    );

alter table public.products
  add column if not exists lifecycle_status text not null default 'ACTIVE'
    check (
      lifecycle_status in (
        'ACTIVE',
        'PAUSED',
        'FAILED',
        'COMPLETED'
      )
    );

alter table public.products
  add column if not exists lifecycle_changed_at timestamptz not null default now();

create table if not exists public.product_lifecycle (
  id uuid primary key default gen_random_uuid(),

  product_id uuid not null
    references public.products(id)
    on delete cascade,

  from_stage text,

  current_stage text not null
    check (
      current_stage in (
        'DISCOVERED',
        'ANALYSED',
        'AI_APPROVED',
        'LISTING_GENERATED',
        'DRAFT_CREATED',
        'PUBLISHED',
        'ADVERTISING',
        'SELLING',
        'SCALING',
        'RETIRED'
      )
    ),

  lifecycle_status text not null default 'ACTIVE'
    check (
      lifecycle_status in (
        'ACTIVE',
        'PAUSED',
        'FAILED',
        'COMPLETED'
      )
    ),

  changed_at timestamptz not null default now(),
  changed_by text not null,
  reason text not null
);

create index if not exists idx_products_current_lifecycle
  on public.products(current_lifecycle, lifecycle_changed_at desc);

create index if not exists idx_product_lifecycle_product
  on public.product_lifecycle(product_id, changed_at desc);

alter table public.product_lifecycle
  enable row level security;

commit;
