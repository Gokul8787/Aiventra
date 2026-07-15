import type { Product } from "@/ai/types/product";
import type { ProductIntelligence } from "@/ai/intelligence/productIntelligenceTypes";

export type ProductDecision =
  | "PUBLISH"
  | "BUY"
  | "WATCH"
  | "REVIEW"
  | "IGNORE";

export type DecisionRisk = "low" | "medium" | "high";
export type DecisionReadiness = "READY" | "NOT_READY";

export type DecisionReason = {
  code: string;
  message: string;
  impact: "positive" | "negative" | "neutral";
};

export type ProductDecisionResult = {
  decision: ProductDecision;
  confidence: number;
  risk: DecisionRisk;
  reasons: DecisionReason[];
  blockers: string[];
  warnings: string[];
  automationAllowed: boolean;
  requiresHumanApproval: boolean;
  readiness: DecisionReadiness;
  readinessBlockingReasons: string[];
  evaluatedAt: string;
  engineVersion: string;
};

export type ProductDecisionInput = {
  product: Product;
  intelligence: ProductIntelligence;
};
