import { z } from "zod";
import type { Product } from "@/ai/types/product";

export const ProductSchema = z.object({
  id: z.string().min(1),
  databaseId: z.string().uuid().optional(),
  organisationId: z.string().uuid().optional(),
  storeId: z.string().uuid().optional(),
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
  decision: z.unknown().optional(),
  explanation: z.unknown().optional(),
  currentLifecycle: z
    .enum([
      "DISCOVERED",
      "ANALYSED",
      "AI_APPROVED",
      "LISTING_GENERATED",
      "DRAFT_CREATED",
      "PUBLISHED",
      "ADVERTISING",
      "SELLING",
      "SCALING",
      "RETIRED",
    ])
    .optional(),
  lifecycleStatus: z
    .enum(["ACTIVE", "PAUSED", "FAILED", "COMPLETED"])
    .optional(),
  lifecycleChangedAt: z.string().optional(),

  imageUrl: z.string().url().optional(),
  sourceUrl: z.string().url().optional(),
  provider: z.string().optional(),
  sku: z.string().optional(),
  variantId: z.string().optional(),
  currency: z.string().optional(),
  stock: z.number().int().nonnegative().optional(),
  averageRating: z.number().min(0).max(5).optional(),
  reviewCount: z.number().int().nonnegative().optional(),
  evidence: z.array(z.unknown()).optional(),
  evidenceRecords: z.array(z.unknown()).optional(),
  verification: z.unknown().optional(),
  costAnalysis: z.unknown().optional(),
  supplierReliability: z.unknown().optional(),
  supplierSnapshot: z.unknown().optional(),
  memory: z.unknown().optional(),

  intelligence: z.custom<Product["intelligence"]>().optional(),
});
