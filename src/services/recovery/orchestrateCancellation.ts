import "server-only";

import type { TenantContext } from "@/context/storeContext";
import { tenantPayload } from "@/context/storeContext";
import { ORDER_EVENTS } from "@/orders/events";
import { analyseCancellationRecovery } from "@/recovery/recoveryDecisionEngine";
import { publishEvent } from "@/services/events/eventRepository";
import { enqueueJobMessage } from "@/services/queues/jobQueue";
import { cancelPendingOrderWork } from "@/services/recovery/cancelPendingOrderWork";
import { escalateRecoveryFailure } from "@/services/recovery/escalateRecoveryFailure";
import { getRecoveryContext } from "@/services/recovery/getRecoveryContext";
import {
  getCancellationRequestById,
  updateCancellationRequest,
} from "@/services/repositories/cancellationRepository";
import {
  appendJobLog,
  createQueuedJob,
  saveQueueMessageId,
} from "@/services/repositories/backgroundJobRepository";
import { saveRecoveryAnalysis } from "@/services/repositories/recoveryRepository";

export async function orchestrateCancellation(input: {
  tenantContext: TenantContext;
  cancellationRequestId: string;
  correlationId?: string;
  causationId?: string;
}) {
  const cancellationRequest = await getCancellationRequestById({
    organisationId: input.tenantContext.organisationId,
    storeId: input.tenantContext.storeId,
    cancellationRequestId: input.cancellationRequestId,
  });

  if (!cancellationRequest) {
    throw new Error("Cancellation request not found.");
  }

  const recoveryContext = await getRecoveryContext({
    tenantContext: input.tenantContext,
    orderId: cancellationRequest.order_id,
  });
  const analysis = analyseCancellationRecovery(recoveryContext);

  await saveRecoveryAnalysis({
    cancellationRequestId: input.cancellationRequestId,
    analysis,
  });

  const queuedCancellation = analysis.queuedWorkCancellationRequired
    ? await cancelPendingOrderWork({
        organisationId: input.tenantContext.organisationId,
        storeId: input.tenantContext.storeId,
        orderId: cancellationRequest.order_id,
      })
    : { cancelledJobIds: [] as string[] };

  if (analysis.decision === "CANCEL_QUEUED_WORK") {
    await updateCancellationRequest({
      cancellationRequestId: input.cancellationRequestId,
      status: "completed",
      decision: analysis.decision,
      confidence: analysis.confidence,
      decisionReasons: analysis.reasons,
      blockers: analysis.blockers,
      warnings: analysis.warnings,
      processingCompletedAt: new Date().toISOString(),
      metadata: {
        recoveryAnalysis: analysis,
        cancelledJobIds: queuedCancellation.cancelledJobIds,
      },
      completed: true,
    });

    await publishEvent({
      tenantContext: input.tenantContext,
      eventType: ORDER_EVENTS.cancellationCompleted,
      aggregateType: "order",
      aggregateId: cancellationRequest.order_id,
      payload: {
        orderId: cancellationRequest.order_id,
        cancellationRequestId: input.cancellationRequestId,
        decision: analysis.decision,
        cancelledJobIds: queuedCancellation.cancelledJobIds,
      },
    });

    return {
      status: "completed" as const,
      decision: analysis.decision,
      queuedCancellation,
    };
  }

  if (analysis.decision === "CANCEL_SUPPLIER_ORDER") {
    const supplierOrderId = recoveryContext.supplierOrder?.id;

    if (
      supplierOrderId &&
      analysis.automaticExecutionAllowed &&
      !analysis.platformCancellationRequired
    ) {
      const job = await createQueuedJob({
        tenantContext: input.tenantContext,
        jobType: "SUPPLIER_CANCELLATION",
        queueName: "aiventra-cj",
        payload: {
          cancellationRequestId: input.cancellationRequestId,
          supplierOrderId,
          orderId: cancellationRequest.order_id,
          tenantContext: tenantPayload(input.tenantContext),
        },
        idempotencyKey: [
          input.tenantContext.organisationId,
          input.tenantContext.storeId,
          input.cancellationRequestId,
          "supplier-cancellation",
        ].join(":"),
      });

      if (!job.queueMessageId) {
        const queueMessageId = await enqueueJobMessage({
          queueName: "aiventra-cj",
          jobId: job.id,
          jobType: "SUPPLIER_CANCELLATION",
          organisationId: input.tenantContext.organisationId,
          storeId: input.tenantContext.storeId,
          payload: {
            cancellationRequestId: input.cancellationRequestId,
            supplierOrderId,
            orderId: cancellationRequest.order_id,
            tenantContext: tenantPayload(input.tenantContext),
          },
          correlationId: input.correlationId,
          causationId: input.causationId,
        });

        await saveQueueMessageId(job.id, queueMessageId);

        await appendJobLog({
          tenantContext: input.tenantContext,
          jobId: job.id,
          level: "info",
          step: "Queued",
          message: "Supplier cancellation queued by recovery workflow.",
          context: {
            cancellationRequestId: input.cancellationRequestId,
            supplierOrderId,
            orderId: cancellationRequest.order_id,
            queueMessageId,
          },
        });
      }

      await updateCancellationRequest({
        cancellationRequestId: input.cancellationRequestId,
        status: "supplier_cancel_requested",
        supplierOrderId,
        decision: analysis.decision,
        confidence: analysis.confidence,
        decisionReasons: analysis.reasons,
        blockers: analysis.blockers,
        warnings: analysis.warnings,
        metadata: {
          recoveryAnalysis: analysis,
          cancelledJobIds: queuedCancellation.cancelledJobIds,
          supplierCancellationJobId: job.id,
        },
      });

      return {
        status: "supplier_cancel_requested" as const,
        decision: analysis.decision,
        queuedCancellation,
        supplierCancellationJobId: job.id,
      };
    }
  }

  await escalateRecoveryFailure({
    tenantContext: input.tenantContext,
    cancellationRequestId: input.cancellationRequestId,
    orderId: cancellationRequest.order_id,
    decision: analysis.decision,
    analysis,
    supplierOrderId: recoveryContext.supplierOrder?.id,
    platformFulfilmentId: recoveryContext.platformFulfilment?.id,
  });

  return {
    status: "review_required" as const,
    decision: analysis.decision,
    queuedCancellation,
  };
}
