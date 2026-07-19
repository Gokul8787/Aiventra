import "server-only";

import type { TenantContext } from "@/context/storeContext";
import { ORDER_EVENTS } from "@/orders/events";
import type { RecoveryAnalysis, RecoveryDecision } from "@/recovery/types";
import { publishEvent } from "@/services/events/eventRepository";
import { createOperationsAlert } from "@/services/repositories/operationsAlertRepository";
import { updateCancellationRequest } from "@/services/repositories/cancellationRepository";

function statusForDecision(decision: RecoveryDecision) {
  if (decision === "TOO_LATE") return "rejected" as const;

  return "review_required" as const;
}

function titleForDecision(decision: RecoveryDecision) {
  switch (decision) {
    case "TOO_LATE":
      return "Recovery blocked because fulfilment has already progressed";
    case "CANCEL_PLATFORM_FULFILMENT":
      return "Platform fulfilment requires manual recovery review";
    case "MANUAL_REVIEW":
      return "Recovery requires manual supplier review";
    default:
      return "Recovery needs operator review";
  }
}

export async function escalateRecoveryFailure(input: {
  tenantContext: TenantContext;
  cancellationRequestId: string;
  orderId: string;
  decision: RecoveryDecision;
  analysis: RecoveryAnalysis;
  supplierOrderId?: string;
  platformFulfilmentId?: string;
  message?: string;
}) {
  const status = statusForDecision(input.decision);
  const summary =
    input.message ||
    input.analysis.blockers[0] ||
    input.analysis.warnings[0] ||
    input.analysis.reasons[0]?.message ||
    "Recovery action requires manual attention.";

  await updateCancellationRequest({
    cancellationRequestId: input.cancellationRequestId,
    status,
    supplierOrderId: input.supplierOrderId,
    platformFulfilmentId: input.platformFulfilmentId,
    blockers: input.analysis.blockers,
    warnings: input.analysis.warnings,
    decision: input.analysis.decision,
    confidence: input.analysis.confidence,
    decisionReasons: input.analysis.reasons,
    processingCompletedAt: new Date().toISOString(),
    metadata: {
      recoveryAnalysis: input.analysis,
      summary,
    },
  });

  await createOperationsAlert({
    organisationId: input.tenantContext.organisationId,
    storeId: input.tenantContext.storeId,
    severity: input.decision === "TOO_LATE" ? "critical" : "warning",
    category: "recovery",
    title: titleForDecision(input.decision),
    message: summary,
    resourceType: "cancellation_request",
    resourceId: input.cancellationRequestId,
    dedupeKey: `recovery:${input.cancellationRequestId}:${input.decision}`,
    metadata: {
      orderId: input.orderId,
      decision: input.decision,
      confidence: input.analysis.confidence,
    },
  });

  await publishEvent({
    tenantContext: input.tenantContext,
    eventType: ORDER_EVENTS.cancellationReviewRequired,
    aggregateType: "order",
    aggregateId: input.orderId,
    payload: {
      orderId: input.orderId,
      cancellationRequestId: input.cancellationRequestId,
      decision: input.decision,
      confidence: input.analysis.confidence,
      summary,
    },
  });
}
