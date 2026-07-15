export type EvidenceSource =
  | "cj"
  | "google_trends"
  | "amazon"
  | "reddit"
  | "tiktok"
  | "reviews"
  | "shopify"
  | "internal";

export type EvidenceMetric =
  | "demand"
  | "competition"
  | "supplier"
  | "shipping"
  | "stock"
  | "price"
  | "reviews"
  | "seasonality";

export interface ProductEvidence {
  source: EvidenceSource;
  metric: EvidenceMetric;

  value: number;
  normalizedScore: number;

  reliability: number;
  freshness: number;
  completeness: number;

  observedAt: string;
  verified: boolean;

  metadata?: Record<string, unknown>;
}
