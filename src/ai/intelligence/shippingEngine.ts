import type { Product } from "@/ai/types/product";
import type { IntelligenceEngine } from "./core/IntelligenceEngine";
import { SCORE_WEIGHTS } from "./scoreEngine";
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

export class ShippingEngine implements IntelligenceEngine<ShippingAnalysis> {
  readonly id = "shipping";
  readonly name = "Shipping";
  readonly version = "1.0.0";
  readonly weight = SCORE_WEIGHTS.shipping;
  readonly enabled = true;
  readonly required = true;

  execute(product: Product): ShippingAnalysis {
    const shippingEvidence = product.evidenceRecords
      ?.filter((evidence) => evidence.category === "shipping")
      .sort((a, b) => b.quality - a.quality)[0];
    const data = shippingEvidence?.data as
      | { shippingCost?: unknown; shippingDays?: unknown }
      | undefined;
    const shippingCost = Number(data?.shippingCost);
    const shippingDays = Number(data?.shippingDays);

    return analyzeShipping({
      shippingDays: Number.isFinite(shippingDays)
        ? shippingDays
        : product.shippingDays,
      shippingCost: Number.isFinite(shippingCost) ? shippingCost : 3.99,
      availableToUK: true,
    });
  }

  getScore(result: ShippingAnalysis): number {
    return result.shippingScore;
  }
}
