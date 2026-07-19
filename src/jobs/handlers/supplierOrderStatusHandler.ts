import "server-only";

import type { TenantContext } from "@/context/storeContext";
import type { JobMessage } from "@/jobs/types";
import { getSupplierConnector } from "@/suppliers/SupplierRegistry";
import { registerSupplierConnectors } from "@/suppliers/registerSupplierConnectors";
import {
  appendSupplierOrderEvent,
  getSupplierOrderById,
  saveSupplierOrderStatusSnapshot,
  updateSupplierOrderFromStatus,
  upsertSupplierPaymentApproval,
} from "@/services/repositories/supplierOrderRepository";
import { enqueueSupplierTrackingSyncJob } from "@/services/jobs/enqueueSupplierOrderJob";
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

function getNextSyncTime(status: string): string | undefined {
  const now = Date.now();

  switch (status) {
    case "CREATED":
    case "AWAITING_PAYMENT":
      return new Date(now + 30 * 60 * 1000).toISOString();
    case "PAID":
    case "PROCESSING":
      return new Date(now + 60 * 60 * 1000).toISOString();
    case "SHIPPED":
      return new Date(now + 6 * 60 * 60 * 1000).toISOString();
    default:
      return undefined;
  }
}

export const supplierOrderStatusHandler: JobHandler = {
  jobType: "SUPPLIER_ORDER_STATUS_SYNC",

  async handle({ message, reportProgress }) {
    registerSupplierConnectors();

    const tenantContext = tenantContextFromMessage(message);
    const supplierOrderId = String(message.payload.supplierOrderId || "");

    if (!supplierOrderId) {
      throw new Error("supplierOrderId is required.");
    }

    await reportProgress(10, "Loading supplier order");

    const supplierOrder = await getSupplierOrderById(
      tenantContext,
      supplierOrderId
    );

    if (!supplierOrder) {
      throw new Error("Supplier order not found.");
    }

    if (!supplierOrder.externalOrderId) {
      throw new Error("Supplier order has no external order ID.");
    }

    if (
      ["DELIVERED", "CANCELLED", "FAILED"].includes(supplierOrder.status)
    ) {
      return {
        resultReference: {
          supplierOrderId,
          status: supplierOrder.status,
          terminal: true,
        },
      };
    }

    await reportProgress(35, "Checking CJ order status");

    const connector = getSupplierConnector(supplierOrder.provider);
    const result = await connector.getOrderStatus(supplierOrder.externalOrderId);

    if (!result.success) {
      throw new Error(result.message || "CJ order status query failed.");
    }

    await reportProgress(70, "Saving supplier status");

    await saveSupplierOrderStatusSnapshot({
      organisationId: message.organisationId,
      storeId: message.storeId,
      supplierOrderId,
      provider: supplierOrder.provider,
      result,
    });

    const nextStatusSyncAt = getNextSyncTime(result.status);

    await updateSupplierOrderFromStatus({
      context: tenantContext,
      supplierOrderId,
      result,
      nextStatusSyncAt,
    });

    if (result.status === "SHIPPED" || result.trackingNumber) {
      await enqueueSupplierTrackingSyncJob({
        tenantContext,
        supplierOrderId,
        externalOrderId: supplierOrder.externalOrderId,
        idempotencyKeySuffix: new Date().toISOString().slice(0, 13),
      });
    }

    if (result.status === "AWAITING_PAYMENT") {
      await upsertSupplierPaymentApproval({
        context: tenantContext,
        supplierOrderId,
        requestedAmount: supplierOrder.totalCost,
        currency: supplierOrder.currency,
        reason: "Manual CJ payment approval is required.",
      });
    }

    await appendSupplierOrderEvent({
      context: tenantContext,
      supplierOrderId,
      eventType: "STATUS_SYNCHRONISED",
      message: `Supplier status synchronised: ${result.status}`,
      payload: {
        remoteStatus: result.remoteStatus,
        paymentStatus: result.paymentStatus,
        requestId: result.requestId,
        nextStatusSyncAt,
      },
    });

    await reportProgress(100, "Supplier order status synchronised");

    return {
      resultReference: {
        supplierOrderId,
        status: result.status,
        paymentStatus: result.paymentStatus,
        nextStatusSyncAt,
      },
    };
  },
};
