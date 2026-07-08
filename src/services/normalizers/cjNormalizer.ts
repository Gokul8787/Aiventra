import { Product } from "@/ai/types/product";
import { CJProductListItem } from "@/services/cjdropshipping/types";

function toNumber(value?: string | number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function normalizeCJProduct(item: CJProductListItem): Product {
  const supplierPrice = toNumber(item.sellPrice || item.nowPrice);
  const sellPrice = Number((supplierPrice * 2.5).toFixed(2));

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
  };
}
