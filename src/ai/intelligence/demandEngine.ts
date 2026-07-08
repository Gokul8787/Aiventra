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
