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

export interface IntelligenceDataQuality {
  status: "estimated" | "verified" | "mixed";
  estimatedFields: string[];
}

export interface ProductIntelligence {
  demand: DemandAnalysis;
  competition: CompetitionAnalysis;
  profit: ProfitAnalysis;
  shipping: ShippingAnalysis;
  supplier: SupplierAnalysis;
  reviews: ReviewAnalysis;
  seasonality: SeasonalityAnalysis;
  confidence: ConfidenceAnalysis;
  overallScore: number;
  dataQuality: IntelligenceDataQuality;
}
