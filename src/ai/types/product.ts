import type { CostAnalysis } from "@/ai/cost/types";
import type { ExplainableDecision } from "@/ai/explainability/types";
import type { ProductMemory } from "@/ai/memory/types";
import type { ProductIntelligence } from "@/ai/intelligence/productIntelligenceTypes";
import type { ProductEvidence } from "@/ai/evidence/types";
import type { Evidence, VerificationSummary } from "@/evidence/types";
import type {
  SupplierReliabilityAnalysis,
  SupplierSnapshot,
} from "@/ai/supplier/types";
import type { ProductDecisionResult } from "@/ai/decision/types";
import type {
  ProductLifecycleStage,
  ProductLifecycleStatus,
} from "@/lifecycle/ProductLifecycle";

export interface Product {
  id: string;
  databaseId?: string;
  organisationId?: string;
  storeId?: string;
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
  decision?: ProductDecisionResult;
  explanation?: ExplainableDecision;
  currentLifecycle?: ProductLifecycleStage;
  lifecycleStatus?: ProductLifecycleStatus;
  lifecycleChangedAt?: string;
  imageUrl?: string;
  sourceUrl?: string;
  provider?: string;
  sku?: string;
  variantId?: string;
  currency?: string;
  stock?: number;
  averageRating?: number;
  reviewCount?: number;
  discoveryWarnings?: string[];
  discoverySignals?: {
    supplierPriceKnown?: boolean;
    stockKnown?: boolean;
  };
  evidence?: ProductEvidence[];
  evidenceRecords?: Evidence[];
  verification?: VerificationSummary;
  costAnalysis?: CostAnalysis;
  supplierReliability?: SupplierReliabilityAnalysis;
  supplierSnapshot?: SupplierSnapshot;
  memory?: ProductMemory;
  intelligence?: ProductIntelligence;
}
