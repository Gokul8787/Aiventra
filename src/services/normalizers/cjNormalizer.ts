import { Product } from "@/ai/types/product";
import { ProductEvidence } from "@/ai/evidence/types";
import { CJProductListItem } from "@/services/cjdropshipping/types";

export function parseCJNumber(
  value?: string | number | null
): number | undefined {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }

  if (typeof value === "number") {
    return Number.isFinite(value) ? value : undefined;
  }

  const matches = value.match(/\d+(?:\.\d+)?/g);

  if (!matches?.length) {
    return undefined;
  }

  const numbers = matches.map(Number).filter(Number.isFinite);

  if (!numbers.length) {
    return undefined;
  }

  return Math.max(...numbers);
}

export function normalizeCJProduct(item: CJProductListItem): Product {
  const supplierPrice = parseCJNumber(
    item.nowPrice ??
      item.sellPrice ??
      item.productPrice ??
      item.productPriceRange
  );
  const stock = parseCJNumber(
    item.inventoryNum ?? item.warehouseInventoryNum ?? item.totalInventory
  );
  const supplierPriceKnown = supplierPrice !== undefined;
  const stockKnown = stock !== undefined;
  const safeSupplierPrice = supplierPrice ?? 0;
  const sellPrice = Number((safeSupplierPrice * 2.5).toFixed(2));
  const observedAt = new Date().toISOString();
  const evidence: ProductEvidence[] = [
    {
      source: "cj",
      metric: "price",
      value: safeSupplierPrice,
      normalizedScore: supplierPriceKnown ? 100 : 0,
      reliability: 90,
      freshness: 100,
      completeness: supplierPriceKnown ? 100 : 0,
      observedAt,
      verified: supplierPriceKnown,
      metadata: {
        field: item.nowPrice
          ? "nowPrice"
          : item.sellPrice
            ? "sellPrice"
            : item.productPrice
              ? "productPrice"
              : item.productPriceRange
                ? "productPriceRange"
                : "unknown",
        supplierPriceKnown,
      },
    },
    {
      source: "cj",
      metric: "stock",
      value: stock ?? 0,
      normalizedScore:
        stock === undefined ? 0 : stock >= 100 ? 90 : stock >= 20 ? 65 : 25,
      reliability: 85,
      freshness: 100,
      completeness: stockKnown ? 100 : 0,
      observedAt,
      verified: stockKnown,
      metadata: {
        stockKnown,
      },
    },
    {
      source: "cj",
      metric: "shipping",
      value: 7,
      normalizedScore: 25,
      reliability: 10,
      freshness: 100,
      completeness: 20,
      observedAt,
      verified: false,
      metadata: {
        note: "Estimated fallback until CJ freight quote API is connected.",
      },
    },
    {
      source: "cj",
      metric: "supplier",
      value: item.supplierName ? 1 : 0,
      normalizedScore: item.supplierName ? 80 : 55,
      reliability: 70,
      freshness: 100,
      completeness: item.supplierName ? 100 : 50,
      observedAt,
      verified: Boolean(item.supplierName),
      metadata: {
        supplierName: item.supplierName || "CJ Dropshipping",
      },
    },
  ];

  return {
    id: item.pid || item.id || crypto.randomUUID(),
    name: item.productNameEn || item.nameEn || "CJ Product",
    category: item.categoryName || "General",
    supplier: "CJ Dropshipping",
    supplierPrice: safeSupplierPrice,
    sellPrice,
    shippingDays: 7,
    trendScore: 75,
    competitionScore: 55,
    profitMargin: 0,
    aiScore: 0,
    reason: "",
    imageUrl: item.productImage || item.bigImage,
    sourceUrl: item.productUrl,
    provider: "cjdropshipping",
    sku: item.productSku || item.sku,
    currency: "GBP",
    stock,
    averageRating: 0,
    reviewCount: 0,
    discoverySignals: {
      supplierPriceKnown,
      stockKnown,
    },
    evidence,
  };
}
