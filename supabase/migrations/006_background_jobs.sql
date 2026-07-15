begin;

alter table public.ai_jobs
  add column if not exists queue_message_id bigint,
  add column if not exists current_step text,
  add column if not exists worker_id text,
  add column if not exists heartbeat_at timestamptz,
  add column if not exists next_retry_at timestamptz,
  add column if not exists result_reference jsonb
    not null default '{}'::jsonb;

alter table public.ai_jobs
  drop constraint if exists ai_jobs_status_check;

alter table public.ai_jobs
  add constraint ai_jobs_status_check
  check (
    status in (
      'queued',
      'running',
      'retrying',
      'completed',
      'failed',
      'cancelled',
      'dead_letter'
    )
  );

create table if not exists public.job_attempts (
  id uuid primary key default gen_random_uuid(),

  job_id uuid not null
    references public.ai_jobs(id)
    on delete cascade,

  attempt_number integer not null,
  worker_id text,
  step text,

  status text not null
    check (
      status in (
        'running',
        'completed',
        'failed'
      )
    ),

  error_message text,
  started_at timestamptz not null default now(),
  completed_at timestamptz,

  unique (job_id, attempt_number)
);

create table if not exists public.job_logs (
  id bigint generated always as identity primary key,

  job_id uuid not null
    references public.ai_jobs(id)
    on delete cascade,

  level text not null
    check (level in ('debug', 'info', 'warning', 'error')),

  message text not null,
  context jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_ai_jobs_status_created
  on public.ai_jobs(status, created_at);

create index if not exists idx_ai_jobs_heartbeat
  on public.ai_jobs(status, heartbeat_at);

create index if not exists idx_job_attempts_job
  on public.job_attempts(job_id, attempt_number desc);

create index if not exists idx_job_logs_job
  on public.job_logs(job_id, created_at);

alter table public.job_attempts enable row level security;
alter table public.job_logs enable row level security;

commit;
