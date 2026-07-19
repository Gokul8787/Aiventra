begin;

alter table if exists public.provider_runs
  add column if not exists metadata jsonb not null default '{}'::jsonb;

commit;
