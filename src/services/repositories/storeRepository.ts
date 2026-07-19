import "server-only";

import type { TenantContext } from "@/context/storeContext";
import { supabaseAdmin } from "@/services/supabase/admin";

export type StorePlatform = "shopify";

export async function getStorePlatform(
  tenantContext: TenantContext
): Promise<StorePlatform> {
  const { data, error } = await supabaseAdmin
    .from("stores")
    .select("platform")
    .eq("id", tenantContext.storeId)
    .eq("organisation_id", tenantContext.organisationId)
    .maybeSingle<{ platform: StorePlatform }>();

  if (error || !data) {
    throw new Error(`Failed to load store platform: ${error?.message || "Not found"}`);
  }

  return data.platform;
}
