import { Product } from "../types/product";

export function scoreProducts(products: Product[]): Product[] {
  return products
    .map((product) => ({
      ...product,
      aiScore:
        Math.round(
          product.trendScore * 0.4 +
          product.profitMargin * 0.4 +
          (100 - product.competitionScore) * 0.2
        ),
    }))
    .sort((a, b) => b.aiScore - a.aiScore);
}
