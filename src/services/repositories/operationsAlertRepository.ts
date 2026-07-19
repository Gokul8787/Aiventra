import "server-only";

import type { TenantContext } from "@/context/storeContext";
import type { OperationsAlertSeverity } from "@/recovery/types";
import { supabaseAdmin } from "@/services/supabase/admin";

export async function createOperationsAlert(input: {
  organisationId: string;
  storeId: string;
  severity: OperationsAlertSeverity;
  category: string;
  title: string;
  message: string;
  resourceType?: string;
  resourceId?: string;
  dedupeKey: string;
  metadata?: Record<string, unknown>;
}) {
  const { data, error } = await supabaseAdmin
    .from("operations_alerts")
    .upsert(
      {
        organisation_id: input.organisationId,
        store_id: input.storeId,
        severity: input.severity,
        category: input.category,
        title: input.title,
        message: input.message,
        resource_type: input.resourceType ?? null,
        resource_id: input.resourceId ?? null,
        status: "open",
        dedupe_key: input.dedupeKey,
        metadata: input.metadata ?? {},
      },
      {
        onConflict: "dedupe_key",
        ignoreDuplicates: true,
      }
    )
    .select("*")
    .maybeSingle();

  if (error) {
    throw new Error(
      `Failed to create operations alert: ${error.message}`
    );
  }

  return data;
}

export async function listOperationsAlertsForResource(input: {
  tenantContext: TenantContext;
  resourceType: string;
  resourceId: string;
}) {
  const { data, error } = await supabaseAdmin
    .from("operations_alerts")
    .select("*")
    .eq("organisation_id", input.tenantContext.organisationId)
    .eq("store_id", input.tenantContext.storeId)
    .eq("resource_type", input.resourceType)
    .eq("resource_id", input.resourceId)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(`Failed to load operations alerts: ${error.message}`);
  }

  return data || [];
}
