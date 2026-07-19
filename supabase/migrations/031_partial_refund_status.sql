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
      'partially_refunded',
      'cancelled',
      'refunded'
    )
  );

commit;
