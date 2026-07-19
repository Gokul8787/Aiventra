import type { Product } from "@/ai/types/product";

import { DISCOVERY_SETTINGS } from "./discoveryConfig";

export type DiscoveryRejection = {
  productId: string;
  productName: string;
  reasons: string[];
};

export function filterDiscoveryProducts(products: Product[]): {
  accepted: Product[];
  rejected: DiscoveryRejection[];
} {
  const accepted: Product[] = [];
  const rejected: DiscoveryRejection[] = [];

  for (const product of products) {
    const reasons: string[] = [];

    if (
      typeof product.stock === "number" &&
      product.stock < DISCOVERY_SETTINGS.minimumStock
    ) {
      reasons.push("Stock below minimum.");
    }

    if (
      product.supplierPrice <= 0 ||
      product.supplierPrice > DISCOVERY_SETTINGS.maximumSupplierPrice
    ) {
      reasons.push("Supplier price outside configured range.");
    }

    if (product.shippingDays > DISCOVERY_SETTINGS.maximumShippingDays) {
      reasons.push("Estimated shipping time exceeds limit.");
    }

    if (reasons.length > 0) {
      rejected.push({
        productId: String(product.id),
        productName: product.name,
        reasons,
      });
    } else {
      accepted.push(product);
    }
  }

  return {
    accepted,
    rejected,
  };
}
