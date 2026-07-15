import type { Product } from "@/ai/types/product";
import type { IntelligenceEngine } from "./core/IntelligenceEngine";
import { SCORE_WEIGHTS } from "./scoreEngine";
import { DemandAnalysis, DemandInput } from "./types";

export function analyzeDemand(input: DemandInput): DemandAnalysis {
  const demandScore = Math.round(
    input.trendScore * 0.5 +
      input.searchVolumeScore * 0.3 +
      input.socialMentionsScore * 0.2
  );

  const demandRisk =
    demandScore >= 75 ? "low" : demandScore >= 45 ? "medium" : "high";

  return {
    demandScore,
    demandRisk,
    reason: `Trend score ${input.trendScore}, search volume score ${input.searchVolumeScore}, social mentions score ${input.socialMentionsScore}.`,
  };
}

export class DemandEngine implements IntelligenceEngine<DemandAnalysis> {
  readonly id = "demand";
  readonly name = "Demand";
  readonly version = "1.0.0";
  readonly weight = SCORE_WEIGHTS.demand;
  readonly enabled = true;
  readonly required = true;

  execute(product: Product): DemandAnalysis {
    return analyzeDemand({
      trendScore: product.trendScore,
      searchVolumeScore: 75,
      socialMentionsScore: 70,
    });
  }

  getScore(result: DemandAnalysis): number {
    return result.demandScore;
  }
}
