begin;

alter table public.supplier_orders
  drop constraint if exists supplier_orders_payment_status_check;

alter table public.supplier_orders
  add constraint supplier_orders_payment_status_check
  check (
    payment_status in (
      'NOT_REQUIRED',
      'UNPAID',
      'PAYMENT_PENDING',
      'PAID',
      'PAYMENT_FAILED',
      'UNKNOWN'
    )
  );

alter table public.supplier_orders
  add column if not exists remote_status text,
  add column if not exists remote_payment_status text,
  add column if not exists parent_order_id text,
  add column if not exists payment_id text,
  add column if not exists last_status_synced_at timestamptz,
  add column if not exists next_status_sync_at timestamptz,
  add column if not exists status_sync_attempts integer
    not null default 0,
  add column if not exists provider_request_id text,
  add column if not exists api_points_used integer,
  add column if not exists api_points_remaining integer,
  add column if not exists api_points_total integer,
  add column if not exists payment_approval_required boolean
    not null default true,
  add column if not exists payment_approved_at timestamptz,
  add column if not exists payment_approved_by uuid
    references auth.users(id)
    on delete set null;

create table if not exists public.supplier_order_status_snapshots (
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
  provider text not null,
  internal_status text not null,
  remote_status text,
  remote_payment_status text,
  external_order_id text,
  parent_order_id text,
  payment_id text,
  provider_request_id text,
  api_points_used integer,
  api_points_remaining integer,
  api_points_total integer,
  raw_response jsonb not null default '{}'::jsonb,
  captured_at timestamptz not null default now()
);

create table if not exists public.supplier_payment_approvals (
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
  status text not null
    check (
      status in (
        'pending',
        'approved',
        'rejected',
        'expired'
      )
    ),
  requested_amount numeric(12,2),
  currency text,
  requested_at timestamptz not null default now(),
  approved_by uuid
    references auth.users(id)
    on delete set null,
  approved_at timestamptz,
  rejected_at timestamptz,
  reason text,
  unique (supplier_order_id)
);

create index if not exists idx_supplier_orders_status_sync
  on public.supplier_orders(status, next_status_sync_at);

create index if not exists idx_supplier_status_snapshots_order
  on public.supplier_order_status_snapshots(
    supplier_order_id,
    captured_at desc
  );

create index if not exists idx_supplier_payment_approvals_order
  on public.supplier_payment_approvals(
    supplier_order_id,
    status,
    requested_at desc
  );

alter table public.supplier_order_status_snapshots
  enable row level security;

alter table public.supplier_payment_approvals
  enable row level security;

drop policy if exists "Members read tenant supplier order status snapshots" on public.supplier_order_status_snapshots;
create policy "Members read tenant supplier order status snapshots"
on public.supplier_order_status_snapshots for select to authenticated
using (public.is_organisation_member(organisation_id) and public.can_access_store(store_id));

drop policy if exists "Members read tenant supplier payment approvals" on public.supplier_payment_approvals;
create policy "Members read tenant supplier payment approvals"
on public.supplier_payment_approvals for select to authenticated
using (public.is_organisation_member(organisation_id) and public.can_access_store(store_id));

commit;
