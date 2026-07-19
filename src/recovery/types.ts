export type RefundStatus =
  | "pending"
  | "processed"
  | "failed"
  | "cancelled";

export type CancellationStatus =
  | "requested"
  | "checking"
  | "supplier_cancel_requested"
  | "supplier_cancelled"
  | "platform_cancel_requested"
  | "completed"
  | "review_required"
  | "rejected"
  | "failed";

export type OperationsAlertSeverity =
  | "info"
  | "warning"
  | "critical";

export type RecoveryDecision =
  | "NO_ACTION"
  | "CANCEL_QUEUED_WORK"
  | "CANCEL_SUPPLIER_ORDER"
  | "CANCEL_PLATFORM_FULFILMENT"
  | "MANUAL_REVIEW"
  | "TOO_LATE";

export type RecoveryDecisionReason = {
  code: string;
  message: string;
  impact: "positive" | "negative" | "neutral";
};

export type RecoveryContext = {
  order: {
    id: string;
    status: string;
    paid: boolean;
    cancelled: boolean;
    partiallyRefunded: boolean;
    fullyRefunded: boolean;
  };
  supplierOrder?: {
    id: string;
    provider: string;
    externalOrderId?: string;
    status: string;
    paymentStatus?: string;
    trackingNumber?: string;
  };
  platformFulfilment?: {
    id: string;
    platform: string;
    externalFulfilmentId?: string;
    status: string;
  };
  queuedJobs: Array<{
    id: string;
    jobType: string;
    status: string;
  }>;
};

export type RecoveryAnalysis = {
  decision: RecoveryDecision;
  confidence: number;
  reasons: RecoveryDecisionReason[];
  blockers: string[];
  warnings: string[];
  supplierCancellationRequired: boolean;
  platformCancellationRequired: boolean;
  queuedWorkCancellationRequired: boolean;
  automaticExecutionAllowed: boolean;
  analysedAt: string;
  engineVersion: string;
};

export type OrderRefundSummary = {
  orderTotal: number;
  refundedTotal: number;
  totalItemQuantity: number;
  refundedItemQuantity: number;
  status: "not_refunded" | "partially_refunded" | "refunded";
};

export type RefundItemInput = {
  externalLineItemId: string;
  quantity: number;
  subtotalAmount: number;
  taxAmount: number;
  totalAmount: number;
  restockType?: string;
  reason?: string;
};

export type RefundInput = {
  organisationId: string;
  storeId: string;
  orderId: string;
  platform: string;
  externalRefundId: string;
  currency: string;
  subtotalAmount: number;
  taxAmount: number;
  shippingAmount: number;
  totalAmount: number;
  reason?: string;
  note?: string;
  processedAt?: string;
  payload?: Record<string, unknown>;
  items: RefundItemInput[];
};
