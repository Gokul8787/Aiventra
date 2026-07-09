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
}
