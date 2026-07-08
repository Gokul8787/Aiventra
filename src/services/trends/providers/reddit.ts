import { TrendProvider } from "../types";
import { Product } from "@/ai/types/product";

export const redditProvider: TrendProvider = {
  name: "Reddit",

  async getProducts(): Promise<Product[]> {
    return [
      {
        id: crypto.randomUUID(),
        name: "Magnetic Cable Organizer",
        category: "Office",
        supplier: "Reddit",
        supplierPrice: 5,
        sellPrice: 19.99,
        shippingDays: 8,
        trendScore: 82,
        competitionScore: 54,
        profitMargin: 76,
        aiScore: 0,
        reason: "",
      },
    ];
  },
};
