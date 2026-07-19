export const RECOVERY_CONFIG = {
  engineVersion: "1.0.0",
  maximumAttempts: 5,
  retryDelaysSeconds: [30, 120, 600, 1800, 7200],
  supplierCancellationAutomaticStatuses: [
    "PENDING",
    "CREATED",
    "AWAITING_PAYMENT",
  ],
  supplierCancellationReviewStatuses: ["PAID", "PROCESSING"],
  supplierCancellationTooLateStatuses: ["SHIPPED", "DELIVERED"],
  requireManualReviewAfterTracking: true,
  requireManualReviewAfterPlatformFulfilment: true,
} as const;
