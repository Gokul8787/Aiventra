import type { IntelligenceScores } from "./intelligenceTypes";
import type { IntelligenceEngineOutputs } from "./ProductIntelligenceResultBuilder";
import { getCoreEngineResults } from "./ProductIntelligenceResultBuilder";

export function extractIntelligenceScores(
  engineOutputs: IntelligenceEngineOutputs
): IntelligenceScores {
  const results = getCoreEngineResults(engineOutputs);

  return {
    demand: results.demand.demandScore,
    competition: results.competition.competitionOpportunityScore,
    profit: results.profit.profitScore,
    supplier: results.supplier.supplierScore,
    shipping: results.shipping.shippingScore,
    reviews: results.reviews.reviewScore,
    seasonality: results.seasonality.seasonalityScore,
    confidence: results.confidence.confidenceScore,
  };
}

export function calculateOverallScoreFromEngineOutputs(
  engineOutputs: IntelligenceEngineOutputs
) {
  const outputs = Object.values(engineOutputs).filter(
    (output) => output.weight > 0
  );
  const totalWeight = outputs.reduce((sum, output) => sum + output.weight, 0);
  const weightedScore =
    totalWeight > 0
      ? outputs.reduce(
          (sum, output) => sum + output.score * output.weight,
          0
        ) / totalWeight
      : 0;

  return {
    scores: Object.fromEntries(
      Object.entries(engineOutputs).map(([engineId, output]) => [
        engineId,
        output.score,
      ])
    ),
    overallScore: Math.round(weightedScore),
  };
}
