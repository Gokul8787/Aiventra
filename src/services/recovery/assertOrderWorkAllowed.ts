import "server-only";

import { supabaseAdmin } from "@/services/supabase/admin";

export async function assertOrderWorkAllowed(orderId: string): Promise<void> {
  const { data, error } = await supabaseAdmin
    .from("orders")
    .select("status")
    .eq("id", orderId)
    .single<{ status: string }>();

  if (error || !data) {
    throw new Error(
      `Unable to verify order state: ${error?.message || "Order missing"}`
    );
  }

  const blockedStatuses = ["cancelled", "refunded"];

  if (blockedStatuses.includes(data.status)) {
    throw new Error(
      `Order work is blocked because the order is ${data.status}.`
    );
  }

  const { count, error: cancellationError } = await supabaseAdmin
    .from("cancellation_requests")
    .select("id", {
      count: "exact",
      head: true,
    })
    .eq("order_id", orderId)
    .in("status", [
      "requested",
      "checking",
      "supplier_cancel_requested",
      "platform_cancel_requested",
      "review_required",
    ]);

  if (cancellationError) {
    throw new Error(
      `Unable to check cancellation state: ${cancellationError.message}`
    );
  }

  if (Number(count || 0) > 0) {
    throw new Error(
      "Order work is blocked by an active cancellation request."
    );
  }
}
