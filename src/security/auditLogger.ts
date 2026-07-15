import "server-only";

import type { AuthenticatedApiContext } from "@/auth/requireApiContext";
import { supabaseAdmin } from "@/services/supabase/admin";

export type AuditOutcome = "success" | "failure" | "denied";

export async function writeAuditLog(input: {
  context?: AuthenticatedApiContext;
  request: Request;
  action: string;
  resourceType: string;
  resourceId?: string;
  outcome: AuditOutcome;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  const forwardedFor = input.request.headers.get("x-forwarded-for");
  const ipAddress =
    forwardedFor?.split(",")[0]?.trim() ||
    input.request.headers.get("x-real-ip");

  const { error } = await supabaseAdmin.from("audit_logs").insert({
    organisation_id: input.context?.tenantContext.organisationId || null,
    store_id: input.context?.tenantContext.storeId || null,
    user_id: input.context?.user.id || null,
    action: input.action,
    resource_type: input.resourceType,
    resource_id: input.resourceId || null,
    outcome: input.outcome,
    request_id: input.context?.requestId || crypto.randomUUID(),
    ip_address: ipAddress || null,
    user_agent: input.request.headers.get("user-agent"),
    metadata: input.metadata || {},
  });

  if (error) {
    console.error("Audit log write failed:", error.message);
  }
}
