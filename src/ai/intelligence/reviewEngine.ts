import type { Product } from "@/ai/types/product";
import type { IntelligenceEngine } from "./core/IntelligenceEngine";
import { SCORE_WEIGHTS } from "./scoreEngine";
import { ReviewAnalysis, ReviewInput } from "./types";

export function analyzeReviews(input: ReviewInput): ReviewAnalysis {
  const ratingScore = (input.averageRating / 5) * 50;
  const volumeScore = Math.min(input.reviewCount / 1000, 1) * 30;
  const sentimentScore = input.sentimentScore * 0.2;

  const reviewScore = Math.round(
    Math.max(0, Math.min(100, ratingScore + volumeScore + sentimentScore))
  );

  const reviewRisk =
    reviewScore >= 75 ? "low" : reviewScore >= 45 ? "medium" : "high";

  return {
    reviewScore,
    reviewRisk,
    reason: `Average rating ${input.averageRating}/5 from ${input.reviewCount} reviews with ${input.sentimentScore}% sentiment score.`,
  };
}

export class ReviewsEngine implements IntelligenceEngine<ReviewAnalysis> {
  readonly id = "reviews";
  readonly name = "Reviews";
  readonly version = "1.0.0";
  readonly weight = SCORE_WEIGHTS.reviews;
  readonly enabled = true;
  readonly required = true;

  execute(product: Product): ReviewAnalysis {
    void product;

    return analyzeReviews({
      averageRating: 4.6,
      reviewCount: 850,
      sentimentScore: 88,
    });
  }

  getScore(result: ReviewAnalysis): number {
    return result.reviewScore;
  }
}
