begin;

create table if not exists public.ai_prompts (
  id uuid primary key default gen_random_uuid(),

  job_id uuid references public.ai_jobs(id),
  product_id uuid references public.products(id),

  feature text not null,
  provider text not null,
  model text not null,
  prompt_version text not null,

  system_prompt text,
  user_prompt text,
  input jsonb,

  created_at timestamptz default now()
);

create table if not exists public.ai_responses (
  id uuid primary key default gen_random_uuid(),

  prompt_id uuid references public.ai_prompts(id),

  response text,
  output jsonb,
  finish_reason text,

  prompt_tokens integer,
  completion_tokens integer,
  total_tokens integer,

  latency_ms integer,
  estimated_cost numeric(10,6),

  model text,

  created_at timestamptz default now()
);

create index if not exists idx_ai_prompt_job
  on public.ai_prompts(job_id);

create index if not exists idx_ai_prompt_product
  on public.ai_prompts(product_id);

create index if not exists idx_ai_prompt_feature
  on public.ai_prompts(feature);

create index if not exists idx_ai_response_prompt
  on public.ai_responses(prompt_id);

create index if not exists idx_ai_response_created
  on public.ai_responses(created_at);

alter table public.ai_prompts enable row level security;
alter table public.ai_responses enable row level security;

commit;
