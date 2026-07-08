import { CompetitionAnalysis, CompetitionInput } from "./types";

export function analyzeCompetition(
  input: CompetitionInput
): CompetitionAnalysis {
  const rawCompetition =
    input.competitionScore * 0.5 +
    input.sellerCountScore * 0.3 +
    input.priceSaturationScore * 0.2;

  const competitionOpportunityScore = Math.round(100 - rawCompetition);

  const competitionRisk =
    competitionOpportunityScore >= 75
      ? "low"
      : competitionOpportunityScore >= 45
      ? "medium"
      : "high";

  return {
    competitionOpportunityScore,
    competitionRisk,
    reason: `Competition score ${input.competitionScore}, seller count score ${input.sellerCountScore}, price saturation score ${input.priceSaturationScore}.`,
  };
}
