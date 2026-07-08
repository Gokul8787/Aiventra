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
