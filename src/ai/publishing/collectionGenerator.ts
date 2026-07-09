import { ProductPublishingInput } from "./types";

export async function generateCollections(input: ProductPublishingInput): Promise<string[]> {
  return Array.from(
    new Set([
      input.product.category,
      "Trending Products",
      "AI Picks",
      input.targetMarket,
    ])
  ).filter(Boolean);
}
