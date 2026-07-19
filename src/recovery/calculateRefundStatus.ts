import type { OrderRefundSummary } from "./types";

export function calculateOrderRefundStatus(input: {
  orderTotal: number;
  refundedTotal: number;
  totalItemQuantity: number;
  refundedItemQuantity: number;
}): OrderRefundSummary {
  const orderTotal = Math.max(0, input.orderTotal);
  const refundedTotal = Math.max(0, input.refundedTotal);

  const totalItemQuantity = Math.max(0, input.totalItemQuantity);
  const refundedItemQuantity = Math.max(0, input.refundedItemQuantity);

  const hasRefund = refundedTotal > 0 || refundedItemQuantity > 0;

  const amountFullyRefunded =
    orderTotal > 0 && refundedTotal >= orderTotal - 0.01;

  const quantityFullyRefunded =
    totalItemQuantity > 0 && refundedItemQuantity >= totalItemQuantity;

  const status: OrderRefundSummary["status"] =
    amountFullyRefunded || quantityFullyRefunded
      ? "refunded"
      : hasRefund
        ? "partially_refunded"
        : "not_refunded";

  return {
    orderTotal,
    refundedTotal,
    totalItemQuantity,
    refundedItemQuantity,
    status,
  };
}
