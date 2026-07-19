begin;

create table if not exists public.security_audit_runs (
  id uuid primary key default gen_random_uuid(),

  organisation_id uuid
    references public.organisations(id)
    on delete cascade,

  store_id uuid
    references public.stores(id)
    on delete cascade,

  audit_type text not null,

  status text not null
    check (
      status in (
        'running',
        'passed',
        'failed',
        'warning'
      )
    ),

  checks jsonb not null default '[]'::jsonb,
  findings jsonb not null default '[]'::jsonb,

  started_at timestamptz not null default now(),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  created_by uuid
    references auth.users(id)
    on delete set null
);

create table if not exists public.store_connections (
  id uuid primary key default gen_random_uuid(),

  organisation_id uuid not null
    references public.organisations(id)
    on delete cascade,

  store_id uuid not null
    references public.stores(id)
    on delete cascade,

  provider text not null,

  status text not null default 'connected'
    check (
      status in (
        'connected',
        'disconnected',
        'error',
        'expired'
      )
    ),

  shop_domain text,

  encrypted_access_token text,
  encrypted_refresh_token text,

  api_version text,

  metadata jsonb not null default '{}'::jsonb,

  last_verified_at timestamptz,
  last_error text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique(store_id, provider)
);

create index if not exists idx_security_audit_runs_created
  on public.security_audit_runs(
    status,
    created_at desc
  );

create index if not exists idx_store_connections_store
  on public.store_connections(
    organisation_id,
    store_id,
    provider
  );

alter table public.security_audit_runs
  enable row level security;

alter table public.store_connections
  enable row level security;

drop policy if exists "Members read security audit runs"
  on public.security_audit_runs;
create policy "Members read security audit runs"
on public.security_audit_runs for select to authenticated
using (
  organisation_id is not null
  and store_id is not null
  and public.is_organisation_member(organisation_id)
  and public.can_access_store(store_id)
);

drop policy if exists "Admins manage security audit runs"
  on public.security_audit_runs;
create policy "Admins manage security audit runs"
on public.security_audit_runs for all to authenticated
using (
  organisation_id is not null
  and public.has_organisation_role(organisation_id, array['owner', 'admin'])
)
with check (
  organisation_id is not null
  and public.has_organisation_role(organisation_id, array['owner', 'admin'])
);

drop policy if exists "Members read store connections"
  on public.store_connections;
create policy "Members read store connections"
on public.store_connections for select to authenticated
using (
  public.is_organisation_member(organisation_id)
  and public.can_access_store(store_id)
);

drop policy if exists "Admins manage store connections"
  on public.store_connections;
create policy "Admins manage store connections"
on public.store_connections for all to authenticated
using (
  public.has_organisation_role(organisation_id, array['owner', 'admin'])
)
with check (
  public.has_organisation_role(organisation_id, array['owner', 'admin'])
);

commit;
