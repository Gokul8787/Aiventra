import { ProductPublishingInput } from "./types";

export async function generateTags(
  input: ProductPublishingInput
): Promise<string[]> {
  const product = input.product;

  return Array.from(
    new Set([
      product.category,
      product.supplier,
      product.provider || "aiventra",
      input.targetMarket,
      "AI Selected",
      "Trending Product",
    ])
  ).filter(Boolean);
}
