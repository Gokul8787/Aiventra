begin;

alter table public.ai_jobs
  drop constraint if exists ai_jobs_job_type_check;

alter table public.ai_jobs
  add constraint ai_jobs_job_type_check
  check (
    job_type in (
      'product_scan',
      'product_analysis',
      'evidence_refresh',
      'listing_generation',
      'shopify_draft_creation',
      'cj_product_refresh',
      'cj_shipping_quote',
      'cj_inventory_refresh',
      'cj_order_creation',
      'cj_tracking_sync',
      'order_validation',
      'supplier_order_creation',
      'supplier_order_status_sync',
      'supplier_tracking_sync',
      'stale_job_recovery',
      'product_publication',
      'marketing_generation',
      'order_fulfilment',
      'tracking_sync'
    )
  );

alter table public.supplier_orders
  add column if not exists carrier_code text,
  add column if not exists carrier_name text,
  add column if not exists tracking_status text,
  add column if not exists last_tracking_synced_at timestamptz,
  add column if not exists next_tracking_sync_at timestamptz,
  add column if not exists tracking_sync_attempts integer
    not null default 0;

create index if not exists idx_supplier_orders_tracking_sync
  on public.supplier_orders(tracking_status, next_tracking_sync_at);

commit;
