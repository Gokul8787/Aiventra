import { z } from "zod";
import type { Product } from "@/ai/types/product";

export const ProductSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(500),
  category: z.string().min(1).max(200),
  supplier: z.string().min(1).max(200),

  supplierPrice: z.number().nonnegative(),
  sellPrice: z.number().positive(),
  shippingDays: z.number().int().nonnegative(),

  trendScore: z.number().min(0).max(100),
  competitionScore: z.number().min(0).max(100),
  profitMargin: z.number(),
  aiScore: z.number().min(0).max(100),

  reason: z.string(),

  imageUrl: z.string().url().optional(),
  sourceUrl: z.string().url().optional(),
  provider: z.string().optional(),
  currency: z.string().optional(),
  stock: z.number().int().nonnegative().optional(),
  averageRating: z.number().min(0).max(5).optional(),
  reviewCount: z.number().int().nonnegative().optional(),

  intelligence: z.custom<Product["intelligence"]>().optional(),
});
