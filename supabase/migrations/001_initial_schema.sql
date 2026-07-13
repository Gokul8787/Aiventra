begin;

create extension if not exists pgcrypto;

-- =========================================================
-- Stores connected to Aiventra
-- =========================================================

create table if not exists public.stores (
  id uuid primary key default gen_random_uuid(),

  platform text not null
    check (platform in (
      'shopify',
      'woocommerce',
      'amazon',
      'ebay',
      'etsy',
      'tiktok_shop'
    )),

  external_shop_id text,
  name text,
  domain text not null,
  storefront_url text,
  currency_code text,

  connection_status text not null default 'connected'
    check (connection_status in (
      'connected',
      'disconnected',
      'error'
    )),

  last_connected_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (platform, domain)
);

-- =========================================================
-- Generic AI/background jobs
-- =========================================================

create table if not exists public.ai_jobs (
  id uuid primary key default gen_random_uuid(),

  job_type text not null
    check (job_type in (
      'product_scan',
      'listing_generation',
      'product_publication',
      'marketing_generation',
      'order_fulfilment',
      'tracking_sync'
    )),

  status text not null default 'queued'
    check (status in (
      'queued',
      'running',
      'completed',
      'failed',
      'cancelled'
    )),

  progress integer not null default 0
    check (progress between 0 and 100),

  input jsonb not null default '{}'::jsonb,
  output jsonb,
  error_message text,

  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

-- =========================================================
-- Product Hunter scans
-- =========================================================

create table if not exists public.product_scans (
  id uuid primary key default gen_random_uuid(),

  job_id uuid references public.ai_jobs(id)
    on delete set null,

  status text not null default 'running'
    check (status in (
      'running',
      'completed',
      'failed'
    )),

  search_query text,
  recommendation_threshold numeric(5,2),

  total_found integer not null default 0,
  total_recommended integer not null default 0,

  started_at timestamptz not null default now(),
  completed_at timestamptz,
  error_message text
);

-- =========================================================
-- Provider execution status per scan
-- =========================================================

create table if not exists public.provider_runs (
  id uuid primary key default gen_random_uuid(),

  scan_id uuid not null
    references public.product_scans(id)
    on delete cascade,

  provider_name text not null,

  status text not null
    check (status in (
      'success',
      'failed',
      'skipped'
    )),

  products_found integer not null default 0,
  duration_ms integer,
  error_message text,

  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

-- =========================================================
-- Normalised supplier/market products
-- =========================================================

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),

  provider text not null,
  external_product_id text not null,

  name text not null,
  category text,
  supplier text,

  supplier_price numeric(12,2) not null default 0,
  suggested_sell_price numeric(12,2),
  currency text not null default 'GBP',

  shipping_days integer,
  shipping_cost numeric(12,2),
  stock integer,

  image_url text,
  source_url text,

  average_rating numeric(3,2),
  review_count integer,

  raw_data jsonb not null default '{}'::jsonb,

  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (provider, external_product_id)
);

-- =========================================================
-- Products discovered during each scan
-- =========================================================

create table if not exists public.scan_products (
  scan_id uuid not null
    references public.product_scans(id)
    on delete cascade,

  product_id uuid not null
    references public.products(id)
    on delete cascade,

  recommended boolean not null default false,
  rank integer,

  created_at timestamptz not null default now(),

  primary key (scan_id, product_id)
);

-- =========================================================
-- Product intelligence snapshot for each scan
-- =========================================================

create table if not exists public.product_intelligence (
  id uuid primary key default gen_random_uuid(),

  scan_id uuid not null
    references public.product_scans(id)
    on delete cascade,

  product_id uuid not null
    references public.products(id)
    on delete cascade,

  demand_score numeric(5,2),
  competition_score numeric(5,2),
  profit_score numeric(5,2),
  shipping_score numeric(5,2),
  supplier_score numeric(5,2),
  review_score numeric(5,2),
  seasonality_score numeric(5,2),
  confidence_score numeric(5,2),
  overall_score numeric(5,2),

  data_quality_status text not null default 'estimated'
    check (data_quality_status in (
      'estimated',
      'mixed',
      'verified'
    )),

  estimated_fields text[] not null default '{}',
  analysis jsonb not null default '{}'::jsonb,

  calculated_at timestamptz not null default now(),

  unique (scan_id, product_id)
);

-- =========================================================
-- AI-generated ecommerce listings
-- =========================================================

create table if not exists public.publishing_packages (
  id uuid primary key default gen_random_uuid(),

  job_id uuid references public.ai_jobs(id)
    on delete set null,

  product_id uuid not null
    references public.products(id)
    on delete cascade,

  title text not null,
  description_html text not null,

  seo_title text,
  seo_description text,

  handle text not null,
  tags text[] not null default '{}',
  collections text[] not null default '{}',

  sell_price numeric(12,2) not null,
  compare_at_price numeric(12,2),

  image_alt_text text,

  validation_passed boolean not null default false,
  validation_errors text[] not null default '{}',

  created_at timestamptz not null default now()
);

-- =========================================================
-- Shopify/connector publication history
-- =========================================================

create table if not exists public.product_publications (
  id uuid primary key default gen_random_uuid(),

  job_id uuid references public.ai_jobs(id)
    on delete set null,

  product_id uuid not null
    references public.products(id)
    on delete cascade,

  publishing_package_id uuid
    references public.publishing_packages(id)
    on delete set null,

  store_id uuid not null
    references public.stores(id)
    on delete cascade,

  platform text not null,
  external_product_id text,
  external_url text,

  status text not null
    check (status in (
      'draft',
      'active',
      'archived',
      'failed'
    )),

  error_message text,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (store_id, product_id)
);

-- =========================================================
-- Helpful indexes
-- =========================================================

create index if not exists idx_ai_jobs_status
  on public.ai_jobs(status);

create index if not exists idx_ai_jobs_type_created
  on public.ai_jobs(job_type, created_at desc);

create index if not exists idx_product_scans_created
  on public.product_scans(started_at desc);

create index if not exists idx_provider_runs_scan
  on public.provider_runs(scan_id);

create index if not exists idx_products_provider
  on public.products(provider);

create index if not exists idx_products_last_seen
  on public.products(last_seen_at desc);

create index if not exists idx_scan_products_recommended
  on public.scan_products(scan_id, recommended);

create index if not exists idx_intelligence_overall_score
  on public.product_intelligence(overall_score desc);

create index if not exists idx_publishing_product
  on public.publishing_packages(product_id);

create index if not exists idx_publications_store_status
  on public.product_publications(store_id, status);

-- =========================================================
-- Row Level Security
-- No public policies yet.
-- Current application writes through the server-only admin client.
-- =========================================================

alter table public.stores enable row level security;
alter table public.ai_jobs enable row level security;
alter table public.product_scans enable row level security;
alter table public.provider_runs enable row level security;
alter table public.products enable row level security;
alter table public.scan_products enable row level security;
alter table public.product_intelligence enable row level security;
alter table public.publishing_packages enable row level security;
alter table public.product_publications enable row level security;

commit;
