import { Product } from "@/ai/types/product";

export async function getTrendProducts(): Promise<Product[]> {
  return [
    {
      id: crypto.randomUUID(),
      name: "Smart Pet Water Fountain",
      category: "Pet",
      supplier: "Trend Source v1",
      supplierPrice: 8,
      sellPrice: 29.99,
      shippingDays: 7,
      trendScore: 88,
      competitionScore: 70,
      profitMargin: 73,
      aiScore: 0,
      reason: "",
    },
    {
      id: crypto.randomUUID(),
      name: "Portable Car Vacuum",
      category: "Car",
      supplier: "Trend Source v1",
      supplierPrice: 11,
      sellPrice: 34.99,
      shippingDays: 6,
      trendScore: 82,
      competitionScore: 66,
      profitMargin: 69,
      aiScore: 0,
      reason: "",
    },
  ];
}
