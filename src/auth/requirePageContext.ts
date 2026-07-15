import "server-only";

import { redirect } from "next/navigation";

import type { TenantContext } from "@/context/storeContext";
import { supabaseAdmin } from "@/services/supabase/admin";
import { createSupabaseServerClient } from "@/services/supabase/server";
import { roleHasPermission } from "./permissions";
import type { OrganisationRole, Permission } from "./types";

type MembershipRow = {
  organisation_id: string;
  role: OrganisationRole;
  organisations?: {
    name?: string | null;
  } | null;
};

type StoreRow = {
  id: string;
  name: string;
  currency: string | null;
  currency_code: string | null;
  timezone: string | null;
  country: string | null;
};

export async function requirePageContext(
  permission: Permission
): Promise<TenantContext> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: membership } = await supabaseAdmin
    .from("organisation_members")
    .select("organisation_id, role, organisations(name)")
    .eq("user_id", user.id)
    .eq("status", "active")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle<MembershipRow>();

  if (!membership || !roleHasPermission(membership.role, permission)) {
    redirect("/login");
  }

  const { data: store } = await supabaseAdmin
    .from("stores")
    .select("id, name, currency, currency_code, timezone, country")
    .eq("organisation_id", membership.organisation_id)
    .eq("active", true)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle<StoreRow>();

  if (!store) {
    redirect("/login");
  }

  return {
    organisationId: membership.organisation_id,
    storeId: store.id,
    userId: user.id,
    timezone: store.timezone || "Europe/London",
    currency: store.currency_code || store.currency || "GBP",
    locale: "en-GB",
    country: store.country || "GB",
    organisationName: membership.organisations?.name || membership.organisation_id,
    storeName: store.name,
  };
}
