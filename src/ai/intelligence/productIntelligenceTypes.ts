import {
  ProfitAnalysis,
  ShippingAnalysis,
  SupplierAnalysis,
  ReviewAnalysis,
  DemandAnalysis,
  CompetitionAnalysis,
  SeasonalityAnalysis,
  ConfidenceAnalysis,
} from "./types";
import type { IntelligenceEngineOutputs } from "./core/IntelligenceEngine";
import type { VerificationSummary } from "@/evidence/types";

export interface IntelligenceDataQuality {
  status: "estimated" | "verified" | "mixed";
  estimatedFields: string[];
}

export interface ProductIntelligenceCoreResults {
  demand: DemandAnalysis;
  competition: CompetitionAnalysis;
  profit: ProfitAnalysis;
  shipping: ShippingAnalysis;
  supplier: SupplierAnalysis;
  reviews: ReviewAnalysis;
  seasonality: SeasonalityAnalysis;
  confidence: ConfidenceAnalysis;
}

export interface ProductIntelligence extends ProductIntelligenceCoreResults {
  engineOutputs: IntelligenceEngineOutputs;
  overallScore: number;
  dataQuality: IntelligenceDataQuality;
  verification?: VerificationSummary;
}
