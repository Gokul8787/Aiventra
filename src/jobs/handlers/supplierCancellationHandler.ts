import type { TenantContext } from "@/context/storeContext";
import { ORDER_EVENTS } from "@/orders/events";
import { completeRecoveryAttempt, startRecoveryAttempt } from "@/services/repositories/recoveryRepository";
import { getCancellationRequestById, updateCancellationRequest } from "@/services/repositories/cancellationRepository";
import { publishEvent } from "@/services/events/eventRepository";
import { cancelSupplierOrder } from "@/services/recovery/cancelSupplierOrder";
import type { JobMessage } from "@/jobs/types";
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

export const supplierCancellationHandler: JobHandler = {
  jobType: "SUPPLIER_CANCELLATION",

  async handle({ message, reportProgress }) {
    const tenantContext = tenantContextFromMessage(message);
    const cancellationRequestId = String(message.payload.cancellationRequestId || "");
    const supplierOrderId = String(message.payload.supplierOrderId || "");

    if (!cancellationRequestId || !supplierOrderId) {
      throw new Error(
        "cancellationRequestId and supplierOrderId are required for SUPPLIER_CANCELLATION jobs."
      );
    }

    const recoveryAttemptId = await startRecoveryAttempt({
      organisationId: tenantContext.organisationId,
      storeId: tenantContext.storeId,
      cancellationRequestId,
      attemptNumber: message.attempt,
      action: "SUPPLIER_CANCELLATION",
    });

    await updateCancellationRequest({
      cancellationRequestId,
      status: "supplier_cancel_requested",
      supplierOrderId,
      attemptCount: message.attempt,
    });

    await reportProgress(30, "Submitting supplier cancellation");

    const result = await cancelSupplierOrder({
      tenantContext,
      supplierOrderId,
      reason: "Cancelled by Aiventra recovery workflow.",
    });
    const cancellationRequest = await getCancellationRequestById({
      organisationId: tenantContext.organisationId,
      storeId: tenantContext.storeId,
      cancellationRequestId,
    });

    await updateCancellationRequest({
      cancellationRequestId,
      status: "completed",
      supplierOrderId,
      processingCompletedAt: new Date().toISOString(),
      metadata: {
        supplierCancellationResult: result,
      },
      completed: true,
    });

    if (cancellationRequest) {
      await publishEvent({
        tenantContext,
        eventType: ORDER_EVENTS.cancellationCompleted,
        aggregateType: "order",
        aggregateId: cancellationRequest.order_id,
        payload: {
          orderId: cancellationRequest.order_id,
          cancellationRequestId,
          supplierOrderId,
          duplicate: result.duplicate,
        },
      });
    }

    await reportProgress(100, "Supplier cancellation complete");
    await completeRecoveryAttempt(recoveryAttemptId);

    return {
      resultReference: {
        cancellationRequestId,
        supplierOrderId,
        recoveryAttemptId,
        duplicate: result.duplicate,
        status: result.status,
      },
    };
  },
};
