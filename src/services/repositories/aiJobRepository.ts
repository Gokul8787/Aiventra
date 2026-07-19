import "server-only";
import { supabaseAdmin } from "@/services/supabase/admin";
import type { TenantContext } from "@/context/storeContext";
import { tenantColumns, tenantPayload } from "@/context/storeContext";

// Tenant-owned rows include organisation_id and store_id via tenantColumns.

export type AIJobType =
  | "product_scan"
  | "listing_generation"
  | "product_publication"
  | "marketing_generation"
  | "order_fulfilment"
  | "tracking_sync";

type AIJobRow = {
  id: string;
};

export async function createAIJob(
  tenantContext: TenantContext,
  jobType: AIJobType,
  input: Record<string, unknown> = {}
): Promise<string> {
  const { data, error } = await supabaseAdmin
    .from("ai_jobs")
    .insert({
      ...tenantColumns(tenantContext),
      job_type: jobType,
      status: "running",
      progress: 0,
      input: {
        ...input,
        tenantContext: tenantPayload(tenantContext),
      },
      started_at: new Date().toISOString(),
    })
    .select("id")
    .single<AIJobRow>();

  if (error || !data) {
    throw new Error(
      `Failed to create AI job: ${error?.message || "No row returned"}`
    );
  }

  return data.id;
}

export async function completeAIJob(
  jobId: string,
  output: Record<string, unknown> = {}
): Promise<void> {
  const { error } = await supabaseAdmin
    .from("ai_jobs")
    .update({
      status: "completed",
      progress: 100,
      output,
      completed_at: new Date().toISOString(),
    })
    .eq("id", jobId);

  if (error) {
    throw new Error(`Failed to complete AI job: ${error.message}`);
  }
}

export async function failAIJob(
  jobId: string,
  errorMessage: string
): Promise<void> {
  const { error } = await supabaseAdmin
    .from("ai_jobs")
    .update({
      status: "failed",
      error_message: errorMessage,
      completed_at: new Date().toISOString(),
    })
    .eq("id", jobId);

  if (error) {
    console.error("Failed to mark AI job as failed:", error.message);
  }
}
