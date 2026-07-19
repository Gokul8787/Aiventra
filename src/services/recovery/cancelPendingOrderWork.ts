import "server-only";

import { supabaseAdmin } from "@/services/supabase/admin";

const CANCELLABLE_JOB_TYPES = [
  "supplier_order_creation",
  "supplier_order_status_sync",
  "supplier_tracking_sync",
  "shopify_fulfilment",
];

export async function cancelPendingOrderWork(input: {
  organisationId: string;
  storeId: string;
  orderId: string;
}) {
  const { data, error } = await supabaseAdmin
    .from("ai_jobs")
    .update({
      status: "cancelled",
      current_step: "Cancelled by recovery workflow",
      completed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("organisation_id", input.organisationId)
    .eq("store_id", input.storeId)
    .contains("input", {
      orderId: input.orderId,
    })
    .in("job_type", CANCELLABLE_JOB_TYPES)
    .in("status", ["queued", "retrying"])
    .select("id");

  if (error) {
    throw new Error(`Failed to cancel order jobs: ${error.message}`);
  }

  return {
    cancelledJobIds: (data ?? []).map((job) => job.id),
  };
}
