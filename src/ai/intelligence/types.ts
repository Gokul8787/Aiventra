import type { EvidenceMetric, ProductEvidence } from "@/ai/evidence/types";

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
  evidence: ProductEvidence[];
  requiredMetrics: EvidenceMetric[];
}

export interface ConfidenceAnalysis {
  confidenceScore: number;
  confidenceRisk: "low" | "medium" | "high";

  evidenceCount: number;
  verifiedEvidenceCount: number;
  sourceCount: number;

  completenessScore: number;
  freshnessScore: number;
  reliabilityScore: number;
  agreementScore: number;

  missingMetrics: EvidenceMetric[];
  conflictingMetrics: EvidenceMetric[];

  reason: string;
}
