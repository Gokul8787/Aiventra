begin;

create table if not exists public.shipment_tracking (
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

  provider text not null,
  tracking_key text not null,

  status text not null default 'pending'
    check (
      status in (
        'pending',
        'tracking_pending',
        'in_transit',
        'out_for_delivery',
        'delivered',
        'exception',
        'returned',
        'cancelled',
        'unknown'
      )
    ),

  tracking_number text,
  courier text,
  tracking_url text,
  shipped_at timestamptz,
  delivered_at timestamptz,
  last_sync_at timestamptz,
  last_event_at timestamptz,
  last_event_summary text,
  raw_data jsonb not null default '{}'::jsonb,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (store_id, tracking_key)
);

create table if not exists public.tracking_events (
  id uuid primary key default gen_random_uuid(),

  organisation_id uuid not null
    references public.organisations(id)
    on delete cascade,

  store_id uuid not null
    references public.stores(id)
    on delete cascade,

  shipment_tracking_id uuid not null
    references public.shipment_tracking(id)
    on delete cascade,

  provider text not null,
  dedupe_key text not null,
  external_event_id text,
  event_code text,

  status text not null default 'unknown'
    check (
      status in (
        'pending',
        'label_created',
        'shipped',
        'in_transit',
        'out_for_delivery',
        'delivered',
        'exception',
        'returned',
        'cancelled',
        'unknown'
      )
    ),

  summary text not null,
  details text,
  location text,
  occurred_at timestamptz not null,
  raw_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),

  unique (store_id, dedupe_key)
);

create table if not exists public.fulfilment_updates (
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

  shipment_tracking_id uuid
    references public.shipment_tracking(id)
    on delete set null,

  provider text not null,
  dedupe_key text not null,
  external_fulfilment_id text,

  status text not null default 'pending'
    check (
      status in (
        'pending',
        'submitted',
        'success',
        'failed'
      )
    ),

  request_payload jsonb not null default '{}'::jsonb,
  response_payload jsonb not null default '{}'::jsonb,
  error_message text,
  processed_at timestamptz,
  created_at timestamptz not null default now(),

  unique (store_id, dedupe_key)
);

create table if not exists public.delivery_events (
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

  shipment_tracking_id uuid not null
    references public.shipment_tracking(id)
    on delete cascade,

  dedupe_key text not null,

  event_type text not null
    check (
      event_type in (
        'TRACKING_RECEIVED',
        'SHIPPED',
        'OUT_FOR_DELIVERY',
        'DELIVERED',
        'EXCEPTION',
        'RETURNED',
        'CANCELLED'
      )
    ),

  status text,
  message text,
  occurred_at timestamptz not null,
  raw_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),

  unique (store_id, dedupe_key)
);

create index if not exists idx_shipment_tracking_order
  on public.shipment_tracking(order_id, created_at desc);

create index if not exists idx_shipment_tracking_supplier_order
  on public.shipment_tracking(supplier_order_id, created_at desc)
  where supplier_order_id is not null;

create index if not exists idx_shipment_tracking_status
  on public.shipment_tracking(
    organisation_id,
    store_id,
    status,
    last_sync_at desc
  );

create index if not exists idx_tracking_events_shipment
  on public.tracking_events(shipment_tracking_id, occurred_at desc);

create index if not exists idx_fulfilment_updates_order
  on public.fulfilment_updates(order_id, created_at desc);

create index if not exists idx_delivery_events_order
  on public.delivery_events(order_id, occurred_at desc);

alter table public.shipment_tracking enable row level security;
alter table public.tracking_events enable row level security;
alter table public.fulfilment_updates enable row level security;
alter table public.delivery_events enable row level security;

drop policy if exists "Members read tenant shipment tracking" on public.shipment_tracking;
create policy "Members read tenant shipment tracking"
on public.shipment_tracking for select to authenticated
using (public.is_organisation_member(organisation_id) and public.can_access_store(store_id));

drop policy if exists "Members read tenant tracking events" on public.tracking_events;
create policy "Members read tenant tracking events"
on public.tracking_events for select to authenticated
using (public.is_organisation_member(organisation_id) and public.can_access_store(store_id));

drop policy if exists "Members read tenant fulfilment updates" on public.fulfilment_updates;
create policy "Members read tenant fulfilment updates"
on public.fulfilment_updates for select to authenticated
using (public.is_organisation_member(organisation_id) and public.can_access_store(store_id));

drop policy if exists "Members read tenant delivery events" on public.delivery_events;
create policy "Members read tenant delivery events"
on public.delivery_events for select to authenticated
using (public.is_organisation_member(organisation_id) and public.can_access_store(store_id));

commit;
