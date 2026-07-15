begin;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text,
  avatar_url text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.organisation_members (
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (
    role in ('owner', 'admin', 'manager', 'analyst', 'operator', 'viewer')
  ),
  status text not null default 'active' check (
    status in ('invited', 'active', 'suspended', 'removed')
  ),
  invited_by uuid references auth.users(id) on delete set null,
  joined_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (organisation_id, user_id)
);

create table if not exists public.store_members (
  store_id uuid not null references public.stores(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (
    role in ('admin', 'manager', 'analyst', 'operator', 'viewer')
  ),
  status text not null default 'active' check (
    status in ('invited', 'active', 'suspended', 'removed')
  ),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (store_id, user_id)
);

create table if not exists public.audit_logs (
  id bigint generated always as identity primary key,
  organisation_id uuid references public.organisations(id) on delete set null,
  store_id uuid references public.stores(id) on delete set null,
  user_id uuid references auth.users(id) on delete set null,
  action text not null,
  resource_type text not null,
  resource_id text,
  outcome text not null check (outcome in ('success', 'failure', 'denied')),
  request_id text,
  ip_address inet,
  user_agent text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.api_rate_limits (
  key text not null,
  route text not null,
  window_started_at timestamptz not null,
  request_count integer not null default 0,
  updated_at timestamptz not null default now(),
  primary key (key, route, window_started_at)
);

create index if not exists idx_org_members_user
  on public.organisation_members(user_id, status);

create index if not exists idx_store_members_user
  on public.store_members(user_id, status);

create index if not exists idx_audit_logs_tenant_created
  on public.audit_logs(organisation_id, store_id, created_at desc);

create index if not exists idx_audit_logs_user_created
  on public.audit_logs(user_id, created_at desc);

create index if not exists idx_rate_limits_updated
  on public.api_rate_limits(updated_at);

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, full_name, avatar_url)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'),
    new.raw_user_meta_data ->> 'avatar_url'
  )
  on conflict (id) do update
  set
    email = excluded.email,
    full_name = coalesce(excluded.full_name, public.profiles.full_name),
    avatar_url = coalesce(excluded.avatar_url, public.profiles.avatar_url),
    updated_at = now();

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
after insert or update on auth.users
for each row
execute procedure public.handle_new_auth_user();

create or replace function public.is_organisation_member(target_organisation_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.organisation_members membership
    where membership.organisation_id = target_organisation_id
      and membership.user_id = (select auth.uid())
      and membership.status = 'active'
  );
$$;

create or replace function public.has_organisation_role(
  target_organisation_id uuid,
  accepted_roles text[]
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.organisation_members membership
    where membership.organisation_id = target_organisation_id
      and membership.user_id = (select auth.uid())
      and membership.status = 'active'
      and membership.role = any(accepted_roles)
  );
$$;

create or replace function public.can_access_store(target_store_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.stores store_record
    join public.organisation_members organisation_membership
      on organisation_membership.organisation_id = store_record.organisation_id
    where store_record.id = target_store_id
      and organisation_membership.user_id = (select auth.uid())
      and organisation_membership.status = 'active'
      and (
        organisation_membership.role in ('owner', 'admin')
        or exists (
          select 1
          from public.store_members store_membership
          where store_membership.store_id = target_store_id
            and store_membership.user_id = (select auth.uid())
            and store_membership.status = 'active'
        )
      )
  );
$$;

create or replace function public.has_store_role(
  target_store_id uuid,
  accepted_roles text[]
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.stores store_record
    join public.organisation_members organisation_membership
      on organisation_membership.organisation_id = store_record.organisation_id
    where store_record.id = target_store_id
      and organisation_membership.user_id = (select auth.uid())
      and organisation_membership.status = 'active'
      and (
        organisation_membership.role in ('owner', 'admin')
        or exists (
          select 1
          from public.store_members store_membership
          where store_membership.store_id = target_store_id
            and store_membership.user_id = (select auth.uid())
            and store_membership.status = 'active'
            and store_membership.role = any(accepted_roles)
        )
      )
  );
$$;

create or replace function public.consume_api_rate_limit(
  rate_limit_key text,
  route_name text,
  maximum_requests integer,
  window_seconds integer
)
returns table (allowed boolean, remaining integer, reset_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_window timestamptz;
  new_count integer;
begin
  if maximum_requests <= 0 or window_seconds <= 0 then
    raise exception 'Invalid rate-limit configuration';
  end if;

  current_window :=
    to_timestamp(floor(extract(epoch from now()) / window_seconds) * window_seconds);

  insert into public.api_rate_limits (
    key,
    route,
    window_started_at,
    request_count,
    updated_at
  )
  values (rate_limit_key, route_name, current_window, 1, now())
  on conflict (key, route, window_started_at)
  do update
  set
    request_count = public.api_rate_limits.request_count + 1,
    updated_at = now()
  returning request_count into new_count;

  return query
  select
    new_count <= maximum_requests,
    greatest(maximum_requests - new_count, 0),
    current_window + make_interval(secs => window_seconds);
end;
$$;

revoke all on function public.consume_api_rate_limit(text, text, integer, integer)
  from public;

grant execute on function public.consume_api_rate_limit(text, text, integer, integer)
  to service_role;

alter table public.profiles enable row level security;
alter table public.organisation_members enable row level security;
alter table public.store_members enable row level security;
alter table public.audit_logs enable row level security;
alter table public.api_rate_limits enable row level security;

drop policy if exists "Users can view own profile" on public.profiles;
create policy "Users can view own profile"
on public.profiles
for select
to authenticated
using ((select auth.uid()) = id);

drop policy if exists "Users can update own profile" on public.profiles;
create policy "Users can update own profile"
on public.profiles
for update
to authenticated
using ((select auth.uid()) = id)
with check ((select auth.uid()) = id);

drop policy if exists "Members can view organisation memberships"
  on public.organisation_members;
create policy "Members can view organisation memberships"
on public.organisation_members
for select
to authenticated
using (public.is_organisation_member(organisation_id));

drop policy if exists "Organisation admins manage memberships"
  on public.organisation_members;
create policy "Organisation admins manage memberships"
on public.organisation_members
for all
to authenticated
using (public.has_organisation_role(organisation_id, array['owner', 'admin']))
with check (public.has_organisation_role(organisation_id, array['owner', 'admin']));

drop policy if exists "Members can view store memberships" on public.store_members;
create policy "Members can view store memberships"
on public.store_members
for select
to authenticated
using (public.can_access_store(store_id));

drop policy if exists "Store admins manage store memberships" on public.store_members;
create policy "Store admins manage store memberships"
on public.store_members
for all
to authenticated
using (public.has_store_role(store_id, array['admin']))
with check (public.has_store_role(store_id, array['admin']));

drop policy if exists "Admins can view tenant audit logs" on public.audit_logs;
create policy "Admins can view tenant audit logs"
on public.audit_logs
for select
to authenticated
using (
  organisation_id is not null
  and public.has_organisation_role(organisation_id, array['owner', 'admin'])
);

alter table if exists public.products enable row level security;
alter table if exists public.product_scans enable row level security;
alter table if exists public.scan_products enable row level security;
alter table if exists public.product_intelligence enable row level security;
alter table if exists public.product_decisions enable row level security;
alter table if exists public.publishing_packages enable row level security;
alter table if exists public.product_publications enable row level security;
alter table if exists public.product_cost_snapshots enable row level security;
alter table if exists public.supplier_snapshots enable row level security;
alter table if exists public.supplier_reliability_snapshots enable row level security;
alter table if exists public.product_memory enable row level security;
alter table if exists public.ai_explanations enable row level security;
alter table if exists public.ai_jobs enable row level security;
alter table if exists public.job_logs enable row level security;
alter table if exists public.automation_rules enable row level security;
alter table if exists public.rule_evaluations enable row level security;

drop policy if exists "Members read tenant products" on public.products;
create policy "Members read tenant products"
on public.products for select to authenticated
using (public.is_organisation_member(organisation_id) and public.can_access_store(store_id));

drop policy if exists "Members read tenant product scans" on public.product_scans;
create policy "Members read tenant product scans"
on public.product_scans for select to authenticated
using (public.is_organisation_member(organisation_id) and public.can_access_store(store_id));

drop policy if exists "Members read tenant scan products" on public.scan_products;
create policy "Members read tenant scan products"
on public.scan_products for select to authenticated
using (public.is_organisation_member(organisation_id) and public.can_access_store(store_id));

drop policy if exists "Members read tenant product intelligence" on public.product_intelligence;
create policy "Members read tenant product intelligence"
on public.product_intelligence for select to authenticated
using (public.is_organisation_member(organisation_id) and public.can_access_store(store_id));

drop policy if exists "Members read tenant product decisions" on public.product_decisions;
create policy "Members read tenant product decisions"
on public.product_decisions for select to authenticated
using (public.is_organisation_member(organisation_id) and public.can_access_store(store_id));

drop policy if exists "Members read tenant publishing packages" on public.publishing_packages;
create policy "Members read tenant publishing packages"
on public.publishing_packages for select to authenticated
using (public.is_organisation_member(organisation_id) and public.can_access_store(store_id));

drop policy if exists "Members read tenant product publications" on public.product_publications;
create policy "Members read tenant product publications"
on public.product_publications for select to authenticated
using (public.is_organisation_member(organisation_id) and public.can_access_store(store_id));

drop policy if exists "Members read tenant cost snapshots" on public.product_cost_snapshots;
create policy "Members read tenant cost snapshots"
on public.product_cost_snapshots for select to authenticated
using (public.is_organisation_member(organisation_id) and public.can_access_store(store_id));

drop policy if exists "Members read tenant supplier snapshots" on public.supplier_snapshots;
create policy "Members read tenant supplier snapshots"
on public.supplier_snapshots for select to authenticated
using (public.is_organisation_member(organisation_id) and public.can_access_store(store_id));

drop policy if exists "Members read tenant supplier reliability snapshots" on public.supplier_reliability_snapshots;
create policy "Members read tenant supplier reliability snapshots"
on public.supplier_reliability_snapshots for select to authenticated
using (public.is_organisation_member(organisation_id) and public.can_access_store(store_id));

drop policy if exists "Members read tenant product memory" on public.product_memory;
create policy "Members read tenant product memory"
on public.product_memory for select to authenticated
using (public.is_organisation_member(organisation_id) and public.can_access_store(store_id));

drop policy if exists "Members read tenant AI explanations" on public.ai_explanations;
create policy "Members read tenant AI explanations"
on public.ai_explanations for select to authenticated
using (public.is_organisation_member(organisation_id) and public.can_access_store(store_id));

drop policy if exists "Members read tenant AI jobs" on public.ai_jobs;
create policy "Members read tenant AI jobs"
on public.ai_jobs for select to authenticated
using (public.is_organisation_member(organisation_id) and public.can_access_store(store_id));

drop policy if exists "Members read tenant job logs" on public.job_logs;
create policy "Members read tenant job logs"
on public.job_logs for select to authenticated
using (public.is_organisation_member(organisation_id) and public.can_access_store(store_id));

drop policy if exists "Members read tenant automation rules" on public.automation_rules;
create policy "Members read tenant automation rules"
on public.automation_rules for select to authenticated
using (public.is_organisation_member(organisation_id) and public.can_access_store(store_id));

drop policy if exists "Members read tenant rule evaluations" on public.rule_evaluations;
create policy "Members read tenant rule evaluations"
on public.rule_evaluations for select to authenticated
using (public.is_organisation_member(organisation_id) and public.can_access_store(store_id));

commit;
