begin;

create table if not exists public.automation_rules (
  id uuid primary key default gen_random_uuid(),

  organisation_id uuid not null
    references public.organisations(id)
    on delete cascade,

  store_id uuid
    references public.stores(id)
    on delete cascade,

  name text not null,
  description text,

  enabled boolean not null default true,
  priority integer not null default 100,
  execution_mode text not null default 'DRY_RUN'
    check (execution_mode in ('DRY_RUN', 'LIVE')),

  logical_operator text not null default 'AND'
    check (logical_operator in ('AND', 'OR')),

  conditions jsonb not null default '[]'::jsonb,
  actions jsonb not null default '[]'::jsonb,

  stop_processing boolean not null default false,

  version integer not null default 1,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.rule_evaluations (
  id uuid primary key default gen_random_uuid(),

  organisation_id uuid not null
    references public.organisations(id)
    on delete cascade,

  store_id uuid not null
    references public.stores(id)
    on delete cascade,

  rule_id uuid not null
    references public.automation_rules(id)
    on delete cascade,

  product_id uuid
    references public.products(id)
    on delete cascade,

  scan_id uuid
    references public.product_scans(id)
    on delete set null,

  matched boolean not null,
  execution_mode text not null default 'DRY_RUN'
    check (execution_mode in ('DRY_RUN', 'LIVE')),

  condition_results jsonb not null default '[]'::jsonb,
  actions jsonb not null default '[]'::jsonb,

  engine_version text not null,
  evaluated_at timestamptz not null default now()
);

create table if not exists public.automation_actions (
  id uuid primary key default gen_random_uuid(),

  organisation_id uuid not null
    references public.organisations(id)
    on delete cascade,

  store_id uuid not null
    references public.stores(id)
    on delete cascade,

  rule_evaluation_id uuid not null
    references public.rule_evaluations(id)
    on delete cascade,

  product_id uuid
    references public.products(id)
    on delete cascade,

  action_type text not null,

  status text not null default 'pending'
    check (
      status in (
        'pending',
        'queued',
        'running',
        'completed',
        'failed',
        'cancelled',
        'approval_required',
        'dry_run'
      )
    ),

  payload jsonb not null default '{}'::jsonb,

  idempotency_key text not null unique,

  attempts integer not null default 0,
  last_error text,

  queued_job_id uuid
    references public.ai_jobs(id)
    on delete set null,

  created_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz
);

create index if not exists idx_rules_tenant_enabled
  on public.automation_rules(
    organisation_id,
    store_id,
    enabled,
    priority desc
  );

create index if not exists idx_rule_evaluations_product
  on public.rule_evaluations(
    organisation_id,
    store_id,
    product_id,
    evaluated_at desc
  );

create index if not exists idx_rule_evaluations_rule
  on public.rule_evaluations(
    rule_id,
    matched,
    evaluated_at desc
  );

create index if not exists idx_actions_status
  on public.automation_actions(
    organisation_id,
    store_id,
    status,
    created_at
  );

insert into public.automation_rules (
  organisation_id,
  store_id,
  name,
  description,
  enabled,
  priority,
  execution_mode,
  logical_operator,
  conditions,
  actions,
  stop_processing
)
values (
  '00000000-0000-4000-8000-000000000001',
  '00000000-0000-4000-8000-000000000002',
  'Generate listing for strong products',
  'Dry-run rule that prepares listings for commercially strong products.',
  true,
  200,
  'DRY_RUN',
  'AND',
  '[
    {
      "field": "product.decision.decision",
      "operator": "eq",
      "value": "PUBLISH"
    },
    {
      "field": "product.decision.confidence",
      "operator": "gte",
      "value": 80
    },
    {
      "field": "product.costAnalysis.netMarginPercent",
      "operator": "gte",
      "value": 25
    },
    {
      "field": "product.stock",
      "operator": "gte",
      "value": 100
    },
    {
      "field": "product.supplierReliability.supplierRisk",
      "operator": "eq",
      "value": "low"
    }
  ]'::jsonb,
  '[
    {
      "type": "GENERATE_LISTING",
      "payload": {}
    }
  ]'::jsonb,
  false
);

insert into public.automation_rules (
  organisation_id,
  store_id,
  name,
  description,
  enabled,
  priority,
  execution_mode,
  logical_operator,
  conditions,
  actions,
  stop_processing
)
values (
  '00000000-0000-4000-8000-000000000001',
  '00000000-0000-4000-8000-000000000002',
  'Create Shopify draft after listing approval',
  'Dry-run rule that checks when a generated listing is safe for draft creation.',
  true,
  150,
  'DRY_RUN',
  'AND',
  '[
    {
      "field": "lifecycle.stage",
      "operator": "eq",
      "value": "LISTING_GENERATED"
    },
    {
      "field": "product.decision.automationAllowed",
      "operator": "eq",
      "value": true
    },
    {
      "field": "product.costAnalysis.financiallyViable",
      "operator": "eq",
      "value": true
    }
  ]'::jsonb,
  '[
    {
      "type": "CREATE_SHOPIFY_DRAFT",
      "payload": {}
    }
  ]'::jsonb,
  false
);

insert into public.automation_rules (
  organisation_id,
  store_id,
  name,
  description,
  enabled,
  priority,
  execution_mode,
  logical_operator,
  conditions,
  actions,
  stop_processing
)
values (
  '00000000-0000-4000-8000-000000000001',
  '00000000-0000-4000-8000-000000000002',
  'Watch promising products',
  'Dry-run rule that schedules another look for watch-list products.',
  true,
  100,
  'DRY_RUN',
  'AND',
  '[
    {
      "field": "product.decision.decision",
      "operator": "eq",
      "value": "WATCH"
    }
  ]'::jsonb,
  '[
    {
      "type": "WATCH_PRODUCT",
      "payload": {
        "recheckAfterHours": 24
      }
    }
  ]'::jsonb,
  false
);

alter table public.automation_rules enable row level security;
alter table public.rule_evaluations enable row level security;
alter table public.automation_actions enable row level security;

commit;
