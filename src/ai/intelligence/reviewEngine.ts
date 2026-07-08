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
