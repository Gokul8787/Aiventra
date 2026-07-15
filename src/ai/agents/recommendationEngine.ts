import { Product } from "@/ai/types/product";
import type { ProductDecision } from "@/ai/decision/types";

export const RECOMMENDATION_THRESHOLD = 70;
export const MAX_RECOMMENDATIONS = 10;

const RECOMMENDATION_DECISIONS: ProductDecision[] = [
  "PUBLISH",
  "BUY",
  "WATCH",
];

const DECISION_SORT_PRIORITY: Record<ProductDecision, number> = {
  PUBLISH: 0,
  BUY: 1,
  WATCH: 2,
  REVIEW: 3,
  IGNORE: 4,
};

function getDecision(product: Product) {
  return product.decision;
}

export function getTopRecommendations(
  products: Product[],
  limit = MAX_RECOMMENDATIONS
): Product[] {
  return products
    .filter((product) => {
      const decision = getDecision(product);

      if (decision) {
        return RECOMMENDATION_DECISIONS.includes(decision.decision);
      }

      return product.aiScore >= RECOMMENDATION_THRESHOLD;
    })
    .sort((a, b) => {
      const decisionA = getDecision(a);
      const decisionB = getDecision(b);

      if (decisionA && decisionB) {
        const priorityDifference =
          DECISION_SORT_PRIORITY[decisionA.decision] -
          DECISION_SORT_PRIORITY[decisionB.decision];

        if (priorityDifference !== 0) return priorityDifference;
      }

      return b.aiScore - a.aiScore;
    })
    .slice(0, limit);
}
