export type ProductCandidate = {
  name: string;
  category: string;
  supplierPrice: number;
  suggestedSellPrice: number;
  shippingDays: number;
  trendScore: number;
  competitionScore: number;
  profitMargin: number;
  aiScore: number;
};

export function runProductHunter(): ProductCandidate[] {
  const products: ProductCandidate[] = [
    {
      name: "Smart Pet Water Fountain",
      category: "Pet Products",
      supplierPrice: 8,
      suggestedSellPrice: 29.99,
      shippingDays: 7,
      trendScore: 88,
      competitionScore: 72,
      profitMargin: 73,
      aiScore: 91,
    },
    {
      name: "Portable Car Vacuum Cleaner",
      category: "Car Accessories",
      supplierPrice: 11,
      suggestedSellPrice: 34.99,
      shippingDays: 6,
      trendScore: 82,
      competitionScore: 68,
      profitMargin: 69,
      aiScore: 87,
    },
    {
      name: "Mini Electric Food Chopper",
      category: "Home & Kitchen",
      supplierPrice: 7,
      suggestedSellPrice: 24.99,
      shippingDays: 8,
      trendScore: 79,
      competitionScore: 65,
      profitMargin: 72,
      aiScore: 84,
    },
  ];

  return products.sort((a, b) => b.aiScore - a.aiScore);
}
