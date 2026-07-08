import { TrendProvider } from "../types";
import { Product } from "@/ai/types/product";

export const googleTrendsProvider: TrendProvider = {
  name: "Google Trends",

  async getProducts(): Promise<Product[]> {
    return [
      {
        id: crypto.randomUUID(),
        name: "Portable Blender",
        category: "Kitchen",
        supplier: "Google Trends",
        supplierPrice: 12,
        sellPrice: 34.99,
        shippingDays: 6,
        trendScore: 90,
        competitionScore: 62,
        profitMargin: 66,
        aiScore: 0,
        reason: "",
      },
    ];
  },
};
