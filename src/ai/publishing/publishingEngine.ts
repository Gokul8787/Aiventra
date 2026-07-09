import { ProductPublishingInput, ProductPublishingOutput } from "./types";
import { generateTitle } from "./titleGenerator";
import { generateDescription } from "./descriptionGenerator";
import { generateSEO } from "./seoGenerator";
import { generatePricing } from "./pricingEngine";
import { generateTags } from "./tagGenerator";
import { generateHandle } from "./handleGenerator";
import { generateCollections } from "./collectionGenerator";
import { validatePublishingPackage } from "./validator";

export async function generatePublishingPackage(
  input: ProductPublishingInput
): Promise<ProductPublishingOutput> {
  const [title, description, seo, pricing, tags, handle, collections] =
    await Promise.all([
      generateTitle(input),
      generateDescription(input),
      generateSEO(input),
      generatePricing(input),
      generateTags(input),
      generateHandle(input),
      generateCollections(input),
    ]);

  const draftOutput: ProductPublishingOutput = {
    title,
    description,
    seoTitle: seo.seoTitle,
    seoDescription: seo.seoDescription,
    tags,
    collections,
    handle,
    sellPrice: pricing.sellPrice,
    compareAtPrice: pricing.compareAtPrice,
    imageAltText: seo.imageAltText,
    validationPassed: false,
    validationErrors: [],
  };

  const validation = validatePublishingPackage(input, draftOutput);

  return {
    ...draftOutput,
    validationPassed: validation.valid,
    validationErrors: validation.errors,
  };
}
