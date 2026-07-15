import type { Product } from "@/ai/types/product";
import type { SupplierSnapshot } from "./types";

function normaliseProvider(product: Product): string {
  return (product.provider || product.supplier || "unknown")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

export function createSupplierSnapshot(product: Product): SupplierSnapshot {
  return {
    provider: normaliseProvider(product),
    supplierId: product.supplier || "unknown-supplier",
    externalProductId: String(product.id),

    supplierPrice: product.supplierPrice,
    stock: product.stock,
    quotedDeliveryDays: product.shippingDays,
    shippingCost: product.costAnalysis?.costs.shippingCost,

    observedAt: new Date().toISOString(),
  };
}
