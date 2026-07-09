import { ProductPublishingInput } from "./types";

export async function generateSEO(input: ProductPublishingInput): Promise<{
  seoTitle: string;
  seoDescription: string;
  imageAltText: string;
}> {
  const product = input.product;

  const seoTitle = `${product.name} | ${input.brandName}`;
  const seoDescription = `Shop ${product.name} from ${input.brandName}. AI-selected product for quality, value and everyday use.`;

  return {
    seoTitle: seoTitle.length > 70 ? seoTitle.slice(0, 67) + "..." : seoTitle,
    seoDescription:
      seoDescription.length > 155
        ? seoDescription.slice(0, 152) + "..."
        : seoDescription,
    imageAltText: `${product.name} product image`,
  };
}
