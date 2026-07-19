import "server-only";

import type { TenantContext } from "@/context/storeContext";
import { getOrderById } from "@/services/repositories/orderRepository";
import { listPlatformFulfilmentsForOrder } from "@/services/repositories/platformFulfilmentRepository";
import { getSupplierOrderByOrderId } from "@/services/repositories/supplierOrderRepository";
import { supabaseAdmin } from "@/services/supabase/admin";
import type { RecoveryContext } from "@/recovery/types";

type QueuedJobRow = {
  id: string;
  job_type: string;
  status: string;
};

export async function getRecoveryContext(input: {
  tenantContext: TenantContext;
  orderId: string;
}): Promise<RecoveryContext> {
  const { tenantContext, orderId } = input;
  const [order, supplierOrder, platformFulfilments, queuedJobsResponse] =
    await Promise.all([
      getOrderById(tenantContext, orderId),
      getSupplierOrderByOrderId(tenantContext, orderId),
      listPlatformFulfilmentsForOrder(tenantContext, orderId),
      supabaseAdmin
        .from("ai_jobs")
        .select("id, job_type, status")
        .eq("organisation_id", tenantContext.organisationId)
        .eq("store_id", tenantContext.storeId)
        .contains("input", { orderId })
        .in("status", ["queued", "running", "retrying"]),
    ]);

  if (!order) {
    throw new Error("Order not found for recovery.");
  }

  if (queuedJobsResponse.error) {
    throw new Error(
      `Failed to load queued recovery jobs: ${queuedJobsResponse.error.message}`
    );
  }

  const platformFulfilment = platformFulfilments[0];
  const queuedJobs = ((queuedJobsResponse.data || []) as QueuedJobRow[]).map(
    (job) => ({
      id: job.id,
      jobType: job.job_type,
      status: job.status,
    })
  );

  return {
    order: {
      id: order.id,
      status: order.status,
      paid: ["paid", "partially_paid"].includes(
        (order.financialStatus || "").toLowerCase()
      ),
      cancelled: order.status === "cancelled",
      partiallyRefunded: order.status === "partially_refunded",
      fullyRefunded: order.status === "refunded",
    },
    supplierOrder: supplierOrder
      ? {
          id: supplierOrder.id,
          provider: supplierOrder.provider,
          externalOrderId: supplierOrder.externalOrderId,
          status: supplierOrder.status,
          paymentStatus: supplierOrder.paymentStatus,
          trackingNumber: supplierOrder.trackingNumber,
        }
      : undefined,
    platformFulfilment: platformFulfilment
      ? {
          id: platformFulfilment.id,
          platform: platformFulfilment.platform,
          externalFulfilmentId: platformFulfilment.externalFulfilmentId,
          status: platformFulfilment.status,
        }
      : undefined,
    queuedJobs,
  };
}
