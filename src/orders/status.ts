export type CommerceOrderStatus =
  | "received"
  | "validated"
  | "awaiting_fulfilment"
  | "awaiting_fulfilment_approval"
  | "manual_review"
  | "blocked"
  | "partially_fulfilled"
  | "fulfilled"
  | "partially_refunded"
  | "cancelled"
  | "refunded";

export type OrderItemFulfilmentStatus =
  | "pending"
  | "ready"
  | "manual_review"
  | "supplier_pending"
  | "supplier_ordered"
  | "partially_fulfilled"
  | "fulfilled"
  | "cancelled"
  | "refunded";

export type OrderValidationStatus = "pending" | "ready" | "review" | "blocked";

export type OrderValidationDecision =
  | "AUTO_FULFIL"
  | "MANUAL_REVIEW"
  | "BLOCKED";

export function getOrderReadinessBadge(status: OrderValidationStatus) {
  switch (status) {
    case "ready":
      return "Ready";
    case "review":
      return "Review";
    case "blocked":
      return "Blocked";
    default:
      return "Pending";
  }
}
