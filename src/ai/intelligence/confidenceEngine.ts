import { ConfidenceAnalysis, ConfidenceInput } from "./types";

export function analyzeConfidence(input: ConfidenceInput): ConfidenceAnalysis {
  const confidenceScore = Math.round(
    input.dataCompletenessScore * 0.4 +
      input.providerAgreementScore * 0.3 +
      input.dataFreshnessScore * 0.3
  );

  const confidenceRisk =
    confidenceScore >= 75 ? "low" : confidenceScore >= 45 ? "medium" : "high";

  return {
    confidenceScore,
    confidenceRisk,
    reason: `Data completeness ${input.dataCompletenessScore}, provider agreement ${input.providerAgreementScore}, freshness ${input.dataFreshnessScore}.`,
  };
}
