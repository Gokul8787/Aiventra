import { Product } from "../types/product";

export function getTopRecommendations(products: Product[], limit = 5): Product[] {
  return products
    .filter((product) => product.aiScore >= 70)
    .sort((a, b) => b.aiScore - a.aiScore)
    .slice(0, limit);
}
