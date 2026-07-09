import { ProductPublishingInput } from "./types";

export async function generatePricing(input: ProductPublishingInput): Promise<{
  sellPrice: number;
  compareAtPrice: number;
}> {
  const product = input.product;

  const basePrice = product.sellPrice || product.supplierPrice * 2.5;
  const sellPrice = Number(basePrice.toFixed(2));
  const compareAtPrice = Number((sellPrice * 1.25).toFixed(2));

  return {
    sellPrice,
    compareAtPrice,
  };
}
