import "server-only";

import type { User } from "@supabase/supabase-js";

import { supabaseAdmin } from "@/services/supabase/admin";
import { createSupabaseServerClient } from "@/services/supabase/server";
import type { TenantContext } from "@/context/storeContext";
import { roleHasPermission } from "./permissions";
import type { OrganisationRole, Permission, StoreRole } from "./types";

export class AuthenticationError extends Error {
  status = 401;
}

export class AuthorisationError extends Error {
  status = 403;
}

export type AuthenticatedApiContext = {
  user: User;
  tenantContext: TenantContext;
  organisationRole: OrganisationRole;
  storeRole?: StoreRole;
  requestId: string;
};

type StoreRow = {
  id: string;
  organisation_id: string;
  name: string;
  currency: string | null;
  currency_code: string | null;
  timezone: string | null;
  country: string | null;
};

type OrganisationMembershipRow = {
  organisation_id: string;
  role: OrganisationRole;
  status: string;
  organisations?: {
    name?: string | null;
  } | null;
};

async function resolveRequestedTenant(input: {
  request: Request;
  userId: string;
}): Promise<{
  organisationId: string;
  storeId: string;
  organisationName?: string;
}> {
  const requestedOrganisationId = input.request.headers
    .get("x-aiventra-organisation-id")
    ?.trim();
  const requestedStoreId = input.request.headers
    .get("x-aiventra-store-id")
    ?.trim();

  if (requestedOrganisationId && requestedStoreId) {
    return {
      organisationId: requestedOrganisationId,
      storeId: requestedStoreId,
    };
  }

  const { data: membership, error: membershipError } = await supabaseAdmin
    .from("organisation_members")
    .select("organisation_id, role, status, organisations(name)")
    .eq("user_id", input.userId)
    .eq("status", "active")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle<OrganisationMembershipRow>();

  if (membershipError || !membership) {
    throw new AuthorisationError("You do not have access to an organisation.");
  }

  const { data: store, error: storeError } = await supabaseAdmin
    .from("stores")
    .select("id")
    .eq("organisation_id", membership.organisation_id)
    .eq("active", true)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle<{ id: string }>();

  if (storeError || !store) {
    throw new AuthorisationError("No active store is available.");
  }

  return {
    organisationId: membership.organisation_id,
    storeId: store.id,
    organisationName: membership.organisations?.name || undefined,
  };
}

export async function requireApiContext(
  request: Request,
  permission: Permission
): Promise<AuthenticatedApiContext> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    throw new AuthenticationError("Authentication is required.");
  }

  const tenantSelection = await resolveRequestedTenant({
    request,
    userId: user.id,
  });
  const organisationId = tenantSelection.organisationId;
  const storeId = tenantSelection.storeId;

  const { data: organisationMembership, error: organisationError } =
    await supabaseAdmin
      .from("organisation_members")
      .select("role, status")
      .eq("organisation_id", organisationId)
      .eq("user_id", user.id)
      .eq("status", "active")
      .maybeSingle<{
        role: OrganisationRole;
        status: string;
      }>();

  if (organisationError || !organisationMembership) {
    throw new AuthorisationError("You do not have access to this organisation.");
  }

  const { data: store, error: storeError } = await supabaseAdmin
    .from("stores")
    .select("id, organisation_id, name, currency, currency_code, timezone, country")
    .eq("id", storeId)
    .eq("organisation_id", organisationId)
    .eq("active", true)
    .maybeSingle<StoreRow>();

  if (storeError || !store) {
    throw new AuthorisationError("The selected store is unavailable.");
  }

  let storeRole: StoreRole | undefined;

  if (!["owner", "admin"].includes(organisationMembership.role)) {
    const { data: storeMembership, error: storeMembershipError } =
      await supabaseAdmin
        .from("store_members")
        .select("role")
        .eq("store_id", storeId)
        .eq("user_id", user.id)
        .eq("status", "active")
        .maybeSingle<{
          role: StoreRole;
        }>();

    if (storeMembershipError || !storeMembership) {
      throw new AuthorisationError("You do not have access to this store.");
    }

    storeRole = storeMembership.role;
  }

  if (!roleHasPermission(organisationMembership.role, permission)) {
    throw new AuthorisationError(`Permission denied: ${permission}`);
  }

  return {
    user,
    organisationRole: organisationMembership.role,
    storeRole,
    tenantContext: {
      organisationId,
      storeId,
      organisationName: tenantSelection.organisationName || organisationId,
      storeName: store.name,
      currency: store.currency_code || store.currency || "GBP",
      timezone: store.timezone || "Europe/London",
      locale: "en-GB",
      country: store.country || "GB",
      userId: user.id,
    },
    requestId: request.headers.get("x-request-id") || crypto.randomUUID(),
  };
}
