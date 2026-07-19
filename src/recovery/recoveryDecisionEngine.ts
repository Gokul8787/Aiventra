import { RECOVERY_CONFIG } from "./config";
import type { RecoveryAnalysis, RecoveryContext } from "./types";

export function analyseCancellationRecovery(
  context: RecoveryContext
): RecoveryAnalysis {
  const reasons: RecoveryAnalysis["reasons"] = [];
  const blockers: string[] = [];
  const warnings: string[] = [];

  const supplierStatus = context.supplierOrder?.status;
  const platformFulfilmentExists = Boolean(context.platformFulfilment?.id);
  const trackingExists = Boolean(context.supplierOrder?.trackingNumber);

  if (
    context.order.status === "cancelled" &&
    !context.supplierOrder &&
    !platformFulfilmentExists
  ) {
    reasons.push({
      code: "NO_EXTERNAL_WORK",
      message: "The order has no supplier order or platform fulfilment.",
      impact: "positive",
    });

    return {
      decision: "CANCEL_QUEUED_WORK",
      confidence: 100,
      reasons,
      blockers,
      warnings,
      supplierCancellationRequired: false,
      platformCancellationRequired: false,
      queuedWorkCancellationRequired: true,
      automaticExecutionAllowed: true,
      analysedAt: new Date().toISOString(),
      engineVersion: RECOVERY_CONFIG.engineVersion,
    };
  }

  if (
    supplierStatus &&
    RECOVERY_CONFIG.supplierCancellationAutomaticStatuses.includes(
      supplierStatus as
        | "PENDING"
        | "CREATED"
        | "AWAITING_PAYMENT"
    )
  ) {
    reasons.push({
      code: "SUPPLIER_ORDER_NOT_PAID",
      message: "The supplier order is in a cancellable pre-payment state.",
      impact: "positive",
    });

    return {
      decision: "CANCEL_SUPPLIER_ORDER",
      confidence: 95,
      reasons,
      blockers,
      warnings,
      supplierCancellationRequired: true,
      platformCancellationRequired: platformFulfilmentExists,
      queuedWorkCancellationRequired: true,
      automaticExecutionAllowed: !platformFulfilmentExists && !trackingExists,
      analysedAt: new Date().toISOString(),
      engineVersion: RECOVERY_CONFIG.engineVersion,
    };
  }

  if (
    supplierStatus &&
    RECOVERY_CONFIG.supplierCancellationReviewStatuses.includes(
      supplierStatus as "PAID" | "PROCESSING"
    )
  ) {
    warnings.push(
      "The supplier order has already been paid or entered processing."
    );

    return {
      decision: "MANUAL_REVIEW",
      confidence: 90,
      reasons: [
        {
          code: "SUPPLIER_ORDER_PROCESSING",
          message:
            "Supplier cancellation may still be possible but requires confirmation.",
          impact: "negative",
        },
      ],
      blockers,
      warnings,
      supplierCancellationRequired: true,
      platformCancellationRequired: platformFulfilmentExists,
      queuedWorkCancellationRequired: true,
      automaticExecutionAllowed: false,
      analysedAt: new Date().toISOString(),
      engineVersion: RECOVERY_CONFIG.engineVersion,
    };
  }

  if (
    trackingExists ||
    supplierStatus === "SHIPPED" ||
    supplierStatus === "DELIVERED"
  ) {
    blockers.push("The supplier shipment has already started or completed.");

    return {
      decision: "TOO_LATE",
      confidence: 98,
      reasons: [
        {
          code: "SHIPMENT_ALREADY_STARTED",
          message: "Tracking or a shipped supplier state already exists.",
          impact: "negative",
        },
      ],
      blockers,
      warnings,
      supplierCancellationRequired: false,
      platformCancellationRequired: platformFulfilmentExists,
      queuedWorkCancellationRequired: true,
      automaticExecutionAllowed: false,
      analysedAt: new Date().toISOString(),
      engineVersion: RECOVERY_CONFIG.engineVersion,
    };
  }

  if (platformFulfilmentExists) {
    return {
      decision: "CANCEL_PLATFORM_FULFILMENT",
      confidence: 85,
      reasons: [
        {
          code: "PLATFORM_FULFILMENT_EXISTS",
          message:
            "A platform fulfilment exists and must be reviewed for cancellation.",
          impact: "negative",
        },
      ],
      blockers,
      warnings,
      supplierCancellationRequired: Boolean(context.supplierOrder),
      platformCancellationRequired: true,
      queuedWorkCancellationRequired: true,
      automaticExecutionAllowed: false,
      analysedAt: new Date().toISOString(),
      engineVersion: RECOVERY_CONFIG.engineVersion,
    };
  }

  return {
    decision: "NO_ACTION",
    confidence: 70,
    reasons: [
      {
        code: "NO_RECOVERY_ACTION_FOUND",
        message: "No automatic recovery action could be selected.",
        impact: "neutral",
      },
    ],
    blockers,
    warnings,
    supplierCancellationRequired: false,
    platformCancellationRequired: false,
    queuedWorkCancellationRequired: true,
    automaticExecutionAllowed: false,
    analysedAt: new Date().toISOString(),
    engineVersion: RECOVERY_CONFIG.engineVersion,
  };
}
