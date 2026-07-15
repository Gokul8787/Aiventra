import { Product } from "@/ai/types/product";
import { ProductEvidence } from "@/ai/evidence/types";
import { CJProductListItem } from "@/services/cjdropshipping/types";

function toNumber(value?: string | number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function normalizeCJProduct(item: CJProductListItem): Product {
  const supplierPrice = toNumber(item.sellPrice || item.nowPrice);
  const sellPrice = Number((supplierPrice * 2.5).toFixed(2));
  const stock = item.inventoryNum || item.warehouseInventoryNum || 0;
  const observedAt = new Date().toISOString();
  const evidence: ProductEvidence[] = [
    {
      source: "cj",
      metric: "price",
      value: supplierPrice,
      normalizedScore: supplierPrice > 0 ? 100 : 0,
      reliability: 90,
      freshness: 100,
      completeness: supplierPrice > 0 ? 100 : 0,
      observedAt,
      verified: true,
      metadata: {
        field: item.nowPrice ? "nowPrice" : "sellPrice",
      },
    },
    {
      source: "cj",
      metric: "stock",
      value: stock,
      normalizedScore: stock >= 100 ? 90 : stock >= 20 ? 65 : 25,
      reliability: 85,
      freshness: 100,
      completeness: stock !== undefined ? 100 : 0,
      observedAt,
      verified: true,
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
    supplierPrice,
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
    evidence,
  };
}
