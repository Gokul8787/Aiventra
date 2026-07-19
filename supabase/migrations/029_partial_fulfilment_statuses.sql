begin;

alter table public.orders
  drop constraint if exists orders_status_check;

alter table public.orders
  add constraint orders_status_check
  check (
    status in (
      'received',
      'validated',
      'awaiting_fulfilment',
      'awaiting_fulfilment_approval',
      'manual_review',
      'blocked',
      'partially_fulfilled',
      'fulfilled',
      'cancelled',
      'refunded'
    )
  );

alter table public.order_items
  drop constraint if exists order_items_fulfilment_status_check;

alter table public.order_items
  add constraint order_items_fulfilment_status_check
  check (
    fulfilment_status in (
      'pending',
      'ready',
      'manual_review',
      'supplier_pending',
      'supplier_ordered',
      'partially_fulfilled',
      'fulfilled',
      'cancelled',
      'refunded'
    )
  );

commit;
