import type { CommerceOrderItem, OrderValidationResult } from "./types";

export function calculateOrderItemProfit(input: {
  price: number;
  quantity: number;
  cost?: number;
}) {
  if (input.cost == null) return undefined;

  return Number(((input.price - input.cost) * input.quantity).toFixed(2));
}

export function getValidationStatusFromDecision(
  decision: OrderValidationResult["decision"]
) {
  if (decision === "AUTO_FULFIL") return "ready";
  if (decision === "BLOCKED") return "blocked";

  return "review";
}

export function hasMappedProducts(items: CommerceOrderItem[]) {
  return items.length > 0 && items.every((item) => Boolean(item.productId));
}
