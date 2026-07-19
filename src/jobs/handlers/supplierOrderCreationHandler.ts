import "server-only";

import type { TenantContext } from "@/context/storeContext";
import type { JobMessage } from "@/jobs/types";
import { createSupplierOrder } from "@/services/fulfilment/createSupplierOrder";
import { enqueueSupplierOrderStatusSyncJob } from "@/services/jobs/enqueueSupplierOrderJob";
import type { JobHandler } from "./types";

function tenantContextFromMessage(message: JobMessage): TenantContext {
  const payloadContext = message.payload.tenantContext as
    | Partial<TenantContext>
    | undefined;

  return {
    organisationId: message.organisationId,
    storeId: message.storeId,
    timezone: payloadContext?.timezone || "Europe/London",
    currency: payloadContext?.currency || "GBP",
    locale: payloadContext?.locale || "en-GB",
    userId: payloadContext?.userId,
    country: payloadContext?.country,
    organisationName: payloadContext?.organisationName,
    storeName: payloadContext?.storeName,
  };
}

export const supplierOrderCreationHandler: JobHandler = {
  jobType: "SUPPLIER_ORDER_CREATION",

  async handle({ message, reportProgress }) {
    const tenantContext = tenantContextFromMessage(message);
    const orderId = String(message.payload.orderId || "");

    if (!orderId) {
      throw new Error("orderId is required for SUPPLIER_ORDER_CREATION jobs.");
    }

    const result = await createSupplierOrder({
      context: tenantContext,
      orderId,
      jobId: message.jobId,
      approved: message.payload.approved === true,
      onProgress: reportProgress,
    });

    if ("supplierOrder" in result && result.status === "awaiting_payment") {
      await enqueueSupplierOrderStatusSyncJob({
        tenantContext,
        supplierOrderId: result.supplierOrder.id,
        externalOrderId: result.supplierOrder.externalOrderId,
        correlationId: message.correlationId,
        causationId: message.jobId,
        delaySeconds: 300,
        idempotencyKeySuffix: "initial",
      });
    }

    return {
      resultReference: {
        orderId,
        status: result.status,
        supplierOrderId:
          "supplierOrder" in result ? result.supplierOrder?.id : undefined,
        externalOrderId:
          "supplierOrder" in result
            ? result.supplierOrder?.externalOrderId
            : undefined,
        blockers: "blockers" in result ? result.blockers : undefined,
      },
    };
  },
};
