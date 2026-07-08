import { IntelligenceScores } from "./intelligenceTypes";

const SCORE_WEIGHTS: IntelligenceScores = {
  demand: 0.2,
  competition: 0.15,
  profit: 0.2,
  supplier: 0.1,
  shipping: 0.1,
  reviews: 0.1,
  seasonality: 0.05,
  confidence: 0.1,
};

function clampScore(score: number) {
  return Math.min(100, Math.max(0, score));
}

export function calculateOverallScore(scores: IntelligenceScores): number {
  const weightedScore =
    clampScore(scores.demand) * SCORE_WEIGHTS.demand +
    clampScore(scores.competition) * SCORE_WEIGHTS.competition +
    clampScore(scores.profit) * SCORE_WEIGHTS.profit +
    clampScore(scores.supplier) * SCORE_WEIGHTS.supplier +
    clampScore(scores.shipping) * SCORE_WEIGHTS.shipping +
    clampScore(scores.reviews) * SCORE_WEIGHTS.reviews +
    clampScore(scores.seasonality) * SCORE_WEIGHTS.seasonality +
    clampScore(scores.confidence) * SCORE_WEIGHTS.confidence;

  return Math.round(weightedScore);
}

export const calculateOverallAIScore = calculateOverallScore;
