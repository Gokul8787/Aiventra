import { ProductPublishingInput } from "./types";

export async function generateTitle(
  input: ProductPublishingInput
): Promise<string> {
  const name = input.product.name.trim();
  const title = `${input.brandName} ${name}`;

  return title.length > 70 ? title.slice(0, 67) + "..." : title;
}
