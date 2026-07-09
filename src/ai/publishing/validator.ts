import { ProductPublishingInput, ProductPublishingOutput } from "./types";

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

export function validatePublishingPackage(
  input: ProductPublishingInput,
  output: ProductPublishingOutput
): ValidationResult {
  const errors: string[] = [];

  if (!output.title) errors.push("Title is missing.");
  if (!output.description) errors.push("Description is missing.");
  if (!input.product.imageUrl) errors.push("Product image is missing.");
  if (output.sellPrice <= input.product.supplierPrice) {
    errors.push("Sell price must be higher than supplier price.");
  }
  if (!output.seoTitle) errors.push("SEO title is missing.");
  if (!output.seoDescription) errors.push("SEO description is missing.");

  return {
    valid: errors.length === 0,
    errors,
  };
}
