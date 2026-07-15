export type SupplierRisk = "low" | "medium" | "high";

export type SupplierMetricStatus = "verified" | "estimated" | "unavailable";

export interface SupplierSnapshot {
  provider: string;
  supplierId: string;
  externalProductId: string;

  supplierPrice?: number;
  stock?: number;
  quotedDeliveryDays?: number;
  shippingCost?: number;

  actualDeliveryDays?: number;
  orderAccurate?: boolean;
  refunded?: boolean;
  supplierResponseHours?: number;

  observedAt: string;
}

export interface SupplierMetric {
  score: number;
  status: SupplierMetricStatus;
  sampleSize: number;
  reason: string;
}

export interface SupplierReliabilityMetrics {
  deliveryTime: SupplierMetric;
  stockStability: SupplierMetric;
  priceStability: SupplierMetric;
  shippingReliability: SupplierMetric;
  orderAccuracy: SupplierMetric;
  refundPerformance: SupplierMetric;
  responseTime: SupplierMetric;
}

export interface SupplierReliabilityAnalysis {
  supplierScore: number;
  supplierRisk: SupplierRisk;
  preferredSupplier: boolean;

  metrics: SupplierReliabilityMetrics;

  reasons: string[];
  warnings: string[];
  missingEvidence: string[];

  sampleSize: number;
  dataQuality: "estimated" | "mixed" | "verified";

  lastUpdated: string;
  engineVersion: string;
}
