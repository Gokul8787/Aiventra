export const SUPPLIER_ENGINE_VERSION = "1.0.0";

export const SUPPLIER_METRIC_WEIGHTS = {
  deliveryTime: 0.2,
  stockStability: 0.2,
  priceStability: 0.15,
  shippingReliability: 0.15,
  orderAccuracy: 0.15,
  refundPerformance: 0.1,
  responseTime: 0.05,
} as const;

export const SUPPLIER_THRESHOLDS = {
  preferredMinimumScore: 80,
  lowRiskMinimumScore: 75,
  mediumRiskMinimumScore: 50,

  minimumVerifiedSnapshots: 5,
  minimumOrderSamples: 10,
};
