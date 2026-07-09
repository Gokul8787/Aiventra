import { ProductPublishingInput } from "./types";

export async function generateHandle(input: ProductPublishingInput): Promise<string> {
  return input.product.name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .slice(0, 80);
}
