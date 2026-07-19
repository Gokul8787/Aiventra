begin;

create or replace function public.acquire_provider_permit(
  requested_provider text
)
returns table (
  granted boolean,
  retry_after_ms integer,
  permitted_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_rate_row public.provider_rate_limits%rowtype;
  v_now timestamptz := clock_timestamp();
  v_next_allowed_at timestamptz;
  v_wait_ms integer;
begin
  select *
  into v_rate_row
  from public.provider_rate_limits
  where provider = requested_provider
  for update;

  if not found then
    raise exception
      'Provider rate limit is not configured: %',
      requested_provider;
  end if;

  if v_rate_row.next_allowed_at <= v_now then
    v_next_allowed_at :=
      v_now +
      (
        v_rate_row.minimum_interval_ms
        * interval '1 millisecond'
      );

    update public.provider_rate_limits
    set
      next_allowed_at = v_next_allowed_at,
      updated_at = v_now
    where provider = requested_provider;

    return query
    select
      true,
      0,
      v_now;

    return;
  end if;

  v_wait_ms := greatest(
    1,
    ceil(
      extract(
        epoch from (
          v_rate_row.next_allowed_at -
          v_now
        )
      ) * 1000
    )::integer
  );

  return query
  select
    false,
    v_wait_ms,
    v_rate_row.next_allowed_at;
end;
$$;

revoke all on function
  public.acquire_provider_permit(text)
from public;

grant execute on function
  public.acquire_provider_permit(text)
to service_role;

commit;
