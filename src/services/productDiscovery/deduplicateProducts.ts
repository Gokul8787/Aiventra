import type { Product } from "@/ai/types/product";

function normaliseText(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function getProductKey(product: Product): string {
  const provider = product.provider || product.supplier || "unknown";
  const externalId = String(product.id || "").trim();

  if (externalId) {
    return `${provider}:${externalId}`;
  }

  return [provider, normaliseText(product.name), product.supplierPrice].join(
    ":"
  );
}

export function deduplicateProducts(products: Product[]): Product[] {
  const unique = new Map<string, Product>();

  for (const product of products) {
    const key = getProductKey(product);
    const existing = unique.get(key);

    if (!existing || (product.stock ?? 0) > (existing.stock ?? 0)) {
      unique.set(key, product);
    }
  }

  return Array.from(unique.values());
}
