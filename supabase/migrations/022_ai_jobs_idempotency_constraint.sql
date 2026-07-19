begin;

alter table if exists public.ai_jobs
  add column if not exists idempotency_key text;

with ranked_jobs as (
  select
    id,
    idempotency_key,
    row_number() over (
      partition by idempotency_key
      order by created_at asc, id asc
    ) as duplicate_rank
  from public.ai_jobs
  where idempotency_key is not null
)
update public.ai_jobs jobs
set idempotency_key = jobs.idempotency_key || ':duplicate:' || jobs.id::text
from ranked_jobs
where jobs.id = ranked_jobs.id
  and ranked_jobs.duplicate_rank > 1;

drop index if exists public.idx_ai_jobs_idempotency;

create unique index if not exists idx_ai_jobs_idempotency_unique
  on public.ai_jobs(idempotency_key);

commit;
