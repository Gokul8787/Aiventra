import { TrendProvider } from "../types";
import { Product } from "@/ai/types/product";

export const amazonProvider: TrendProvider = {
  name: "Amazon",

  async getProducts(): Promise<Product[]> {
    return [
      {
        id: crypto.randomUUID(),
        name: "LED Sunset Projection Lamp",
        category: "Home Decor",
        supplier: "Amazon",
        supplierPrice: 9,
        sellPrice: 27.99,
        shippingDays: 5,
        trendScore: 86,
        competitionScore: 58,
        profitMargin: 72,
        aiScore: 0,
        reason: "",
      },
    ];
  },
};
