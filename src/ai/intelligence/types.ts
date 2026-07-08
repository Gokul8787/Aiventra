export interface ProfitInput {
  supplierCost: number;
  shippingCost: number;
  sellPrice: number;
  platformFeePercent: number;
  estimatedAdCost: number;
  returnAllowancePercent: number;
}

export interface ProfitAnalysis {
  grossProfit: number;
  netProfit: number;
  margin: number;
  roi: number;
  breakEvenROAS: number;
  recommendedSellPrice: number;
  profitScore: number;
}

export interface ShippingInput {
  shippingDays: number;
  shippingCost: number;
  availableToUK: boolean;
}

export interface ShippingAnalysis {
  shippingScore: number;
  shippingRisk: "low" | "medium" | "high";
  reason: string;
}

export interface SupplierInput {
  supplierRating: number;
  fulfilmentRate: number;
  orderHistory: number;
}

export interface SupplierAnalysis {
  supplierScore: number;
  supplierRisk: "low" | "medium" | "high";
  reason: string;
}

export interface ReviewInput {
  averageRating: number;
  reviewCount: number;
  sentimentScore: number;
}

export interface ReviewAnalysis {
  reviewScore: number;
  reviewRisk: "low" | "medium" | "high";
  reason: string;
}

export interface SeasonalityInput {
  currentMonth: number;
  peakMonths: number[];
}

export interface SeasonalityAnalysis {
  seasonalityScore: number;
  seasonalityRisk: "low" | "medium" | "high";
  reason: string;
}

export interface DemandInput {
  trendScore: number;
  searchVolumeScore: number;
  socialMentionsScore: number;
}

export interface DemandAnalysis {
  demandScore: number;
  demandRisk: "low" | "medium" | "high";
  reason: string;
}

export interface CompetitionInput {
  competitionScore: number;
  sellerCountScore: number;
  priceSaturationScore: number;
}

export interface CompetitionAnalysis {
  competitionOpportunityScore: number;
  competitionRisk: "low" | "medium" | "high";
  reason: string;
}

export interface ConfidenceInput {
  dataCompletenessScore: number;
  providerAgreementScore: number;
  dataFreshnessScore: number;
}

export interface ConfidenceAnalysis {
  confidenceScore: number;
  confidenceRisk: "low" | "medium" | "high";
  reason: string;
}
