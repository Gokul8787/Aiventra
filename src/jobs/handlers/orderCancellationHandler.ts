import type { TenantContext } from "@/context/storeContext";
import { completeRecoveryAttempt, startRecoveryAttempt } from "@/services/repositories/recoveryRepository";
import { updateCancellationRequest } from "@/services/repositories/cancellationRepository";
import { orchestrateCancellation } from "@/services/recovery/orchestrateCancellation";
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

export const orderCancellationHandler: JobHandler = {
  jobType: "ORDER_CANCELLATION",

  async handle({ message, reportProgress }) {
    const tenantContext = tenantContextFromMessage(message);
    const cancellationRequestId = String(message.payload.cancellationRequestId || "");

    if (!cancellationRequestId) {
      throw new Error("cancellationRequestId is required for ORDER_CANCELLATION jobs.");
    }

    const recoveryAttemptId = await startRecoveryAttempt({
      organisationId: tenantContext.organisationId,
      storeId: tenantContext.storeId,
      cancellationRequestId,
      attemptNumber: message.attempt,
      action: "ORDER_CANCELLATION",
    });

    await updateCancellationRequest({
      cancellationRequestId,
      status: "checking",
      attemptCount: message.attempt,
      processingStartedAt: new Date().toISOString(),
    });

    await reportProgress(20, "Loading recovery context");

    const result = await orchestrateCancellation({
      tenantContext,
      cancellationRequestId,
      correlationId: message.correlationId,
      causationId: message.causationId,
    });

    await reportProgress(100, "Recovery orchestration complete");
    await completeRecoveryAttempt(recoveryAttemptId);

    return {
      resultReference: {
        cancellationRequestId,
        recoveryAttemptId,
        ...result,
      },
    };
  },
};
