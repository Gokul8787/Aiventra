import { Product } from "../types/product";

export function addReasoning(products: Product[]): Product[] {
  return products.map((product) => {
    const reasons: string[] = [];

    if (product.profitMargin >= 70) {
      reasons.push("high profit margin");
    }

    if (product.trendScore >= 80) {
      reasons.push("strong trend demand");
    }

    if (product.competitionScore <= 70) {
      reasons.push("manageable competition");
    }

    if (product.shippingDays <= 7) {
      reasons.push("fast shipping");
    }

    return {
      ...product,
      reason:
        reasons.length > 0
          ? `Recommended because it has ${reasons.join(", ")}.`
          : "Needs further review before recommendation.",
    };
  });
}
