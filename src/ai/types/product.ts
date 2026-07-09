import { ProductIntelligence } from "@/ai/intelligence/productIntelligenceTypes";

export interface Product {
  id: string;
  name: string;
  category: string;
  supplier: string;
  supplierPrice: number;
  sellPrice: number;
  shippingDays: number;
  trendScore: number;
  competitionScore: number;
  profitMargin: number;
  aiScore: number;
  reason: string;
  imageUrl?: string;
  sourceUrl?: string;
  provider?: string;
  currency?: string;
  stock?: number;
  averageRating?: number;
  reviewCount?: number;
  intelligence?: ProductIntelligence;
}
