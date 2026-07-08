import { TrendProvider } from "../types";
import { Product } from "@/ai/types/product";
import { getCJProducts } from "@/services/cjdropshipping/products";

function toNumber(value?: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export const cjDropshippingProvider: TrendProvider = {
  name: "CJ Dropshipping",

  async getProducts(): Promise<Product[]> {
    const cjProducts = await getCJProducts("pet");

    return cjProducts.slice(0, 10).map((item) => {
      const supplierPrice = toNumber(item.nowPrice || item.sellPrice);
      const sellPrice = Number((supplierPrice * 2.5).toFixed(2));
      const category =
        item.threeCategoryName ||
        item.twoCategoryName ||
        item.oneCategoryName ||
        item.categoryName ||
        "General";

      return {
        id: item.id || item.pid || crypto.randomUUID(),
        name: item.nameEn || item.productNameEn || "CJ Product",
        category,
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
    });
  },
};
