import type { Product } from "@/ai/types/product";
import type { IntelligenceEngine } from "./core/IntelligenceEngine";
import { SCORE_WEIGHTS } from "./scoreEngine";
import { SeasonalityAnalysis, SeasonalityInput } from "./types";

export function analyzeSeasonality(
  input: SeasonalityInput
): SeasonalityAnalysis {
  const isPeakMonth = input.peakMonths.includes(input.currentMonth);
  const isNearPeak = input.peakMonths.some(
    (month) => Math.abs(month - input.currentMonth) <= 1
  );

  const seasonalityScore = isPeakMonth ? 95 : isNearPeak ? 80 : 65;

  const seasonalityRisk =
    seasonalityScore >= 75 ? "low" : seasonalityScore >= 45 ? "medium" : "high";

  return {
    seasonalityScore,
    seasonalityRisk,
    reason: isPeakMonth
      ? "Product is currently in peak seasonal demand."
      : isNearPeak
      ? "Product is close to peak seasonal demand."
      : "Product has moderate seasonal demand.",
  };
}

export class SeasonalityEngine
  implements IntelligenceEngine<SeasonalityAnalysis>
{
  readonly id = "seasonality";
  readonly name = "Seasonality";
  readonly version = "1.0.0";
  readonly weight = SCORE_WEIGHTS.seasonality;
  readonly enabled = true;
  readonly required = true;

  execute(_product: Product): SeasonalityAnalysis {
    return analyzeSeasonality({
      currentMonth: new Date().getMonth() + 1,
      peakMonths: [11, 12, 1],
    });
  }

  getScore(result: SeasonalityAnalysis): number {
    return result.seasonalityScore;
  }
}
