begin;

-- =========================================================
-- Refunds
-- =========================================================

create table if not exists public.refunds (
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

  platform text not null,
  external_refund_id text not null,

  status text not null default 'processed'
    check (
      status in (
        'pending',
        'processed',
        'failed',
        'cancelled'
      )
    ),

  currency text not null,

  subtotal_amount numeric(12,2) not null default 0,
  tax_amount numeric(12,2) not null default 0,
  shipping_amount numeric(12,2) not null default 0,
  total_amount numeric(12,2) not null default 0,

  reason text,
  note text,

  processed_at timestamptz,
  payload jsonb not null default '{}'::jsonb,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (
    store_id,
    platform,
    external_refund_id
  )
);

create table if not exists public.refund_items (
  id uuid primary key default gen_random_uuid(),

  refund_id uuid not null
    references public.refunds(id)
    on delete cascade,

  order_item_id uuid
    references public.order_items(id)
    on delete set null,

  external_line_item_id text,

  quantity integer not null
    check (quantity > 0),

  subtotal_amount numeric(12,2) not null default 0,
  tax_amount numeric(12,2) not null default 0,
  total_amount numeric(12,2) not null default 0,

  restock_type text,
  reason text,

  created_at timestamptz not null default now(),

  unique (
    refund_id,
    external_line_item_id
  )
);

-- =========================================================
-- Cancellation workflow
-- =========================================================

create table if not exists public.cancellation_requests (
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

  supplier_order_id uuid
    references public.supplier_orders(id)
    on delete set null,

  platform_fulfilment_id uuid
    references public.platform_fulfilments(id)
    on delete set null,

  source text not null
    check (
      source in (
        'shopify',
        'customer',
        'operator',
        'automation'
      )
    ),

  status text not null default 'requested'
    check (
      status in (
        'requested',
        'checking',
        'supplier_cancel_requested',
        'supplier_cancelled',
        'platform_cancel_requested',
        'completed',
        'review_required',
        'rejected',
        'failed'
      )
    ),

  reason text,
  requested_by uuid
    references auth.users(id)
    on delete set null,

  idempotency_key text not null unique,

  blockers text[] not null default '{}',
  warnings text[] not null default '{}',

  metadata jsonb not null default '{}'::jsonb,

  requested_at timestamptz not null default now(),
  completed_at timestamptz,
  updated_at timestamptz not null default now()
);

-- =========================================================
-- Recovery and escalation
-- =========================================================

create table if not exists public.operations_alerts (
  id uuid primary key default gen_random_uuid(),

  organisation_id uuid not null
    references public.organisations(id)
    on delete cascade,

  store_id uuid not null
    references public.stores(id)
    on delete cascade,

  severity text not null
    check (
      severity in (
        'info',
        'warning',
        'critical'
      )
    ),

  category text not null,
  title text not null,
  message text not null,

  resource_type text,
  resource_id text,

  status text not null default 'open'
    check (
      status in (
        'open',
        'acknowledged',
        'resolved',
        'dismissed'
      )
    ),

  dedupe_key text not null unique,

  metadata jsonb not null default '{}'::jsonb,

  created_at timestamptz not null default now(),
  acknowledged_at timestamptz,
  resolved_at timestamptz
);

create index if not exists idx_refunds_order
  on public.refunds(order_id, created_at desc);

create index if not exists idx_refund_items_order_item
  on public.refund_items(order_item_id);

create index if not exists idx_cancellations_order
  on public.cancellation_requests(order_id, requested_at desc);

create index if not exists idx_operations_alerts_open
  on public.operations_alerts(
    organisation_id,
    store_id,
    status,
    severity,
    created_at desc
  );

alter table public.refunds enable row level security;
alter table public.refund_items enable row level security;
alter table public.cancellation_requests enable row level security;
alter table public.operations_alerts enable row level security;

commit;
