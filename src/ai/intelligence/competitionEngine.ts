import type { Product } from "@/ai/types/product";
import type { IntelligenceEngine } from "./core/IntelligenceEngine";
import { SCORE_WEIGHTS } from "./scoreEngine";
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

export class CompetitionEngine
  implements IntelligenceEngine<CompetitionAnalysis>
{
  readonly id = "competition";
  readonly name = "Competition";
  readonly version = "1.0.0";
  readonly weight = SCORE_WEIGHTS.competition;
  readonly enabled = true;
  readonly required = true;

  execute(product: Product): CompetitionAnalysis {
    return analyzeCompetition({
      competitionScore: product.competitionScore,
      sellerCountScore: 60,
      priceSaturationScore: 55,
    });
  }

  getScore(result: CompetitionAnalysis): number {
    return result.competitionOpportunityScore;
  }
}
