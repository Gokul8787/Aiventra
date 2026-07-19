import type { Product } from "@/ai/types/product";

import { DISCOVERY_SETTINGS } from "./discoveryConfig";

export type DiscoveryCandidate = {
  product: Product;
  warnings: string[];
};

export type DiscoveryWarning = {
  productId: string;
  productName: string;
  warnings: string[];
};

export type DiscoveryRejection = {
  productId: string;
  productName: string;
  reasons: string[];
};

export function summariseDiscoveryReasons(
  rejected: Array<{ reasons: string[] }>
): Record<string, number> {
  const summary: Record<string, number> = {};

  for (const product of rejected) {
    for (const reason of product.reasons) {
      summary[reason] = (summary[reason] ?? 0) + 1;
    }
  }

  return summary;
}

function isKnownStock(product: Product) {
  return (
    product.discoverySignals?.stockKnown === true ||
    (typeof product.stock === "number" &&
      Number.isFinite(product.stock) &&
      product.stock > 0)
  );
}

function isKnownSupplierPrice(product: Product) {
  return (
    product.discoverySignals?.supplierPriceKnown === true ||
    (typeof product.supplierPrice === "number" &&
      Number.isFinite(product.supplierPrice) &&
      product.supplierPrice > 0)
  );
}

export function filterDiscoveryProducts(products: Product[]): {
  accepted: DiscoveryCandidate[];
  rejected: DiscoveryRejection[];
  warnings: DiscoveryWarning[];
} {
  const accepted: DiscoveryCandidate[] = [];
  const rejected: DiscoveryRejection[] = [];
  const warnings: DiscoveryWarning[] = [];

  for (const product of products) {
    const reasons: string[] = [];
    const productWarnings: string[] = [];
    const stockKnown = isKnownStock(product);
    const supplierPriceKnown = isKnownSupplierPrice(product);

    if (
      stockKnown &&
      typeof product.stock === "number" &&
      product.stock < DISCOVERY_SETTINGS.minimumStock
    ) {
      reasons.push("confirmed_stock_below_minimum");
    }

    if (
      supplierPriceKnown &&
      product.supplierPrice > DISCOVERY_SETTINGS.maximumSupplierPrice
    ) {
      reasons.push("confirmed_price_above_maximum");
    }

    if (!stockKnown) {
      productWarnings.push("stock_requires_live_verification");
    }

    if (!supplierPriceKnown) {
      productWarnings.push("price_requires_live_verification");
    }

    if (product.shippingDays > DISCOVERY_SETTINGS.maximumShippingDays) {
      reasons.push("estimated_shipping_exceeds_limit");
    }

    if (reasons.length > 0) {
      rejected.push({
        productId: String(product.id),
        productName: product.name,
        reasons,
      });
    } else {
      if (productWarnings.length > 0) {
        warnings.push({
          productId: String(product.id),
          productName: product.name,
          warnings: productWarnings,
        });
      }

      accepted.push({
        product: productWarnings.length
          ? {
              ...product,
              discoveryWarnings: [
                ...(product.discoveryWarnings || []),
                ...productWarnings,
              ],
            }
          : product,
        warnings: productWarnings,
      });
    }
  }

  return {
    accepted,
    rejected,
    warnings,
  };
}
