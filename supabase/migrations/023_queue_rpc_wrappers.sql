begin;

create or replace function public.enqueue_job_message(
  queue_name text,
  message jsonb,
  sleep_seconds integer default 0
)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  message_id bigint;
begin
  execute 'select pgmq.send($1, $2, $3)'
  into message_id
  using queue_name, message, sleep_seconds;

  return message_id;
exception
  when invalid_schema_name or undefined_function then
    raise exception
      'Supabase Queues/pgmq is not available. Enable Supabase Queues before enqueueing jobs.';
end;
$$;

create or replace function public.read_job_messages(
  queue_name text,
  visibility_timeout_seconds integer default 300,
  message_count integer default 1
)
returns table (
  msg_id bigint,
  read_ct integer,
  enqueued_at timestamptz,
  vt timestamptz,
  message jsonb
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  return query execute
    'select msg_id, read_ct, enqueued_at, vt, message from pgmq.read($1, $2, $3)'
    using queue_name, visibility_timeout_seconds, message_count;
exception
  when invalid_schema_name or undefined_function then
    raise exception
      'Supabase Queues/pgmq is not available. Enable Supabase Queues before reading jobs.';
end;
$$;

create or replace function public.archive_job_message(
  queue_name text,
  message_id bigint
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  archived boolean;
begin
  execute 'select pgmq.archive($1, $2)'
  into archived
  using queue_name, message_id;

  return archived;
exception
  when invalid_schema_name or undefined_function then
    raise exception
      'Supabase Queues/pgmq is not available. Enable Supabase Queues before archiving jobs.';
end;
$$;

create or replace function public.delete_job_message(
  queue_name text,
  message_id bigint
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  deleted boolean;
begin
  execute 'select pgmq.delete($1, $2)'
  into deleted
  using queue_name, message_id;

  return deleted;
exception
  when invalid_schema_name or undefined_function then
    raise exception
      'Supabase Queues/pgmq is not available. Enable Supabase Queues before deleting jobs.';
end;
$$;

revoke execute on function public.enqueue_job_message(text, jsonb, integer)
  from public, anon, authenticated;
revoke execute on function public.read_job_messages(text, integer, integer)
  from public, anon, authenticated;
revoke execute on function public.archive_job_message(text, bigint)
  from public, anon, authenticated;
revoke execute on function public.delete_job_message(text, bigint)
  from public, anon, authenticated;

grant execute on function public.enqueue_job_message(text, jsonb, integer)
  to service_role;
grant execute on function public.read_job_messages(text, integer, integer)
  to service_role;
grant execute on function public.archive_job_message(text, bigint)
  to service_role;
grant execute on function public.delete_job_message(text, bigint)
  to service_role;

commit;
