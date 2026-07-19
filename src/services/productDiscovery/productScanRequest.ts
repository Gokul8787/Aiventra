import { z } from "zod";

import { DISCOVERY_CATEGORIES } from "./discoveryConfig";

export const ProductScanRequestSchema = z
  .object({
    mode: z.enum(["broad", "category", "keyword"]).default("broad"),
    categoryId: z.string().min(1).optional(),
    keyword: z.string().trim().min(2).max(100).optional(),
  })
  .superRefine((value, context) => {
    if (value.mode === "category" && !value.categoryId) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["categoryId"],
        message: "categoryId is required for category mode.",
      });
    }

    if (
      value.mode === "category" &&
      value.categoryId &&
      !DISCOVERY_CATEGORIES.some(
        (category) => category.enabled && category.id === value.categoryId
      )
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["categoryId"],
        message: "Unknown or disabled discovery category.",
      });
    }

    if (value.mode === "keyword" && !value.keyword) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["keyword"],
        message: "keyword is required for keyword mode.",
      });
    }
  });

export type ProductScanRequest = z.infer<typeof ProductScanRequestSchema>;

export function parseProductScanRequest(input: unknown): ProductScanRequest {
  return ProductScanRequestSchema.parse(input || {});
}

export function getProductScanSearchLabel(request: ProductScanRequest): string {
  if (request.mode === "keyword") return request.keyword || "keyword";
  if (request.mode === "category") return request.categoryId || "category";

  return "multi-category";
}
