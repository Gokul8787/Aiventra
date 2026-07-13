import { Product } from "@/ai/types/product";

export const RECOMMENDATION_THRESHOLD = 70;
export const MAX_RECOMMENDATIONS = 10;

export function getTopRecommendations(
  products: Product[],
  limit = MAX_RECOMMENDATIONS
): Product[] {
  return products
    .filter((product) => product.aiScore >= RECOMMENDATION_THRESHOLD)
    .sort((a, b) => b.aiScore - a.aiScore)
    .slice(0, limit);
}
