import { SupplierAnalysis, SupplierInput } from "./types";

export function analyzeSupplier(input: SupplierInput): SupplierAnalysis {
  const ratingScore = (input.supplierRating / 5) * 40;
  const fulfilmentScore = input.fulfilmentRate * 0.4;
  const historyScore = Math.min(input.orderHistory / 1000, 1) * 20;

  const supplierScore = Math.round(
    Math.max(0, Math.min(100, ratingScore + fulfilmentScore + historyScore))
  );

  const supplierRisk =
    supplierScore >= 75 ? "low" : supplierScore >= 45 ? "medium" : "high";

  return {
    supplierScore,
    supplierRisk,
    reason: `Supplier rating ${input.supplierRating}/5, fulfilment rate ${input.fulfilmentRate}%, order history ${input.orderHistory}.`,
  };
}
