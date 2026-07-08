import { ShippingAnalysis, ShippingInput } from "./types";

export function analyzeShipping(input: ShippingInput): ShippingAnalysis {
  let shippingScore = 100;

  if (input.shippingDays > 3) shippingScore -= 10;
  if (input.shippingDays > 7) shippingScore -= 20;
  if (input.shippingDays > 14) shippingScore -= 30;

  if (input.shippingCost > 3) shippingScore -= 10;
  if (input.shippingCost > 6) shippingScore -= 15;

  if (!input.availableToUK) shippingScore = 0;

  shippingScore = Math.max(0, Math.min(100, shippingScore));

  const shippingRisk =
    shippingScore >= 75 ? "low" : shippingScore >= 45 ? "medium" : "high";

  return {
    shippingScore,
    shippingRisk,
    reason: !input.availableToUK
      ? "Product is not available for UK delivery."
      : `Delivery takes ${input.shippingDays} days with £${input.shippingCost} shipping cost.`,
  };
}
