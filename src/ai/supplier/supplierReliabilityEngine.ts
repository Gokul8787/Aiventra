import {
  SupplierMetric,
  SupplierReliabilityAnalysis,
  SupplierSnapshot,
} from "./types";

import {
  SUPPLIER_ENGINE_VERSION,
  SUPPLIER_METRIC_WEIGHTS,
  SUPPLIER_THRESHOLDS,
} from "./config";

import {
  average,
  clampScore,
  coefficientOfVariation,
} from "./statistics";

function unavailableMetric(reason: string): SupplierMetric {
  return {
    score: 50,
    status: "unavailable",
    sampleSize: 0,
    reason,
  };
}

function calculatePriceStability(snapshots: SupplierSnapshot[]): SupplierMetric {
  const prices = snapshots
    .map((snapshot) => snapshot.supplierPrice)
    .filter((value): value is number => typeof value === "number" && value >= 0);

  if (prices.length < 2) {
    return unavailableMetric(
      "At least two supplier price observations are required."
    );
  }

  const variation = coefficientOfVariation(prices);

  if (variation === null) {
    return unavailableMetric("Supplier price variation could not be calculated.");
  }

  const score = clampScore(100 - variation * 300);

  return {
    score,
    status:
      prices.length >= SUPPLIER_THRESHOLDS.minimumVerifiedSnapshots
        ? "verified"
        : "estimated",
    sampleSize: prices.length,
    reason: `Price variation is ${(variation * 100).toFixed(1)}%.`,
  };
}

function calculateStockStability(snapshots: SupplierSnapshot[]): SupplierMetric {
  const stockValues = snapshots
    .map((snapshot) => snapshot.stock)
    .filter((value): value is number => typeof value === "number" && value >= 0);

  if (stockValues.length < 2) {
    return unavailableMetric("At least two stock observations are required.");
  }

  const outOfStockCount = stockValues.filter((stock) => stock === 0).length;
  const outOfStockRate = outOfStockCount / stockValues.length;
  const variation = coefficientOfVariation(stockValues) ?? 1;

  const score = clampScore(
    100 - outOfStockRate * 70 - Math.min(variation, 1) * 30
  );

  return {
    score,
    status:
      stockValues.length >= SUPPLIER_THRESHOLDS.minimumVerifiedSnapshots
        ? "verified"
        : "estimated",
    sampleSize: stockValues.length,
    reason: `${outOfStockCount} of ${stockValues.length} observations were out of stock.`,
  };
}

function calculateDeliveryTime(snapshots: SupplierSnapshot[]): SupplierMetric {
  const actualDays = snapshots
    .map((snapshot) => snapshot.actualDeliveryDays)
    .filter((value): value is number => typeof value === "number" && value >= 0);

  const quotedDays = snapshots
    .map((snapshot) => snapshot.quotedDeliveryDays)
    .filter((value): value is number => typeof value === "number" && value >= 0);

  const values = actualDays.length > 0 ? actualDays : quotedDays;

  if (values.length === 0) {
    return unavailableMetric("No delivery-time evidence is available.");
  }

  const mean = average(values) ?? 30;

  const score =
    mean <= 5
      ? 100
      : mean <= 7
        ? 90
        : mean <= 10
          ? 75
          : mean <= 14
            ? 55
            : mean <= 21
              ? 30
              : 10;

  return {
    score,
    status: actualDays.length >= 3 ? "verified" : "estimated",
    sampleSize: values.length,
    reason:
      actualDays.length > 0
        ? `Average actual delivery time is ${mean.toFixed(1)} days.`
        : `Average quoted delivery time is ${mean.toFixed(1)} days.`,
  };
}

function calculateShippingReliability(
  snapshots: SupplierSnapshot[]
): SupplierMetric {
  const comparable = snapshots.filter(
    (snapshot) =>
      typeof snapshot.quotedDeliveryDays === "number" &&
      typeof snapshot.actualDeliveryDays === "number"
  );

  if (comparable.length === 0) {
    return unavailableMetric(
      "Quoted and actual delivery evidence is not yet available."
    );
  }

  const onTime = comparable.filter(
    (snapshot) =>
      (snapshot.actualDeliveryDays ?? 0) <=
      (snapshot.quotedDeliveryDays ?? 0) + 1
  ).length;

  const onTimeRate = onTime / comparable.length;

  return {
    score: clampScore(onTimeRate * 100),
    status: comparable.length >= 5 ? "verified" : "estimated",
    sampleSize: comparable.length,
    reason: `${onTime} of ${comparable.length} orders arrived within the quoted delivery window.`,
  };
}

function calculateOrderAccuracy(snapshots: SupplierSnapshot[]): SupplierMetric {
  const orderResults = snapshots
    .map((snapshot) => snapshot.orderAccurate)
    .filter((value): value is boolean => typeof value === "boolean");

  if (orderResults.length === 0) {
    return unavailableMetric("No completed-order accuracy evidence is available.");
  }

  const accurate = orderResults.filter(Boolean).length;
  const accuracyRate = accurate / orderResults.length;

  return {
    score: clampScore(accuracyRate * 100),
    status:
      orderResults.length >= SUPPLIER_THRESHOLDS.minimumOrderSamples
        ? "verified"
        : "estimated",
    sampleSize: orderResults.length,
    reason: `${accurate} of ${orderResults.length} orders were fulfilled accurately.`,
  };
}

function calculateRefundPerformance(
  snapshots: SupplierSnapshot[]
): SupplierMetric {
  const refundResults = snapshots
    .map((snapshot) => snapshot.refunded)
    .filter((value): value is boolean => typeof value === "boolean");

  if (refundResults.length === 0) {
    return unavailableMetric("No refund evidence is available.");
  }

  const refunds = refundResults.filter(Boolean).length;
  const refundRate = refunds / refundResults.length;

  return {
    score: clampScore(100 - refundRate * 100),
    status:
      refundResults.length >= SUPPLIER_THRESHOLDS.minimumOrderSamples
        ? "verified"
        : "estimated",
    sampleSize: refundResults.length,
    reason: `${refunds} refunds occurred across ${refundResults.length} tracked orders.`,
  };
}

function calculateResponseTime(snapshots: SupplierSnapshot[]): SupplierMetric {
  const responseHours = snapshots
    .map((snapshot) => snapshot.supplierResponseHours)
    .filter((value): value is number => typeof value === "number" && value >= 0);

  if (responseHours.length === 0) {
    return unavailableMetric("No supplier-response evidence is available.");
  }

  const mean = average(responseHours) ?? 72;

  const score =
    mean <= 2
      ? 100
      : mean <= 6
        ? 90
        : mean <= 12
          ? 75
          : mean <= 24
            ? 60
            : mean <= 48
              ? 35
              : 10;

  return {
    score,
    status: responseHours.length >= 5 ? "verified" : "estimated",
    sampleSize: responseHours.length,
    reason: `Average supplier response time is ${mean.toFixed(1)} hours.`,
  };
}

export function analyseSupplierReliability(
  snapshots: SupplierSnapshot[]
): SupplierReliabilityAnalysis {
  const metrics = {
    deliveryTime: calculateDeliveryTime(snapshots),
    stockStability: calculateStockStability(snapshots),
    priceStability: calculatePriceStability(snapshots),
    shippingReliability: calculateShippingReliability(snapshots),
    orderAccuracy: calculateOrderAccuracy(snapshots),
    refundPerformance: calculateRefundPerformance(snapshots),
    responseTime: calculateResponseTime(snapshots),
  };

  const weightedScore =
    metrics.deliveryTime.score * SUPPLIER_METRIC_WEIGHTS.deliveryTime +
    metrics.stockStability.score * SUPPLIER_METRIC_WEIGHTS.stockStability +
    metrics.priceStability.score * SUPPLIER_METRIC_WEIGHTS.priceStability +
    metrics.shippingReliability.score *
      SUPPLIER_METRIC_WEIGHTS.shippingReliability +
    metrics.orderAccuracy.score * SUPPLIER_METRIC_WEIGHTS.orderAccuracy +
    metrics.refundPerformance.score * SUPPLIER_METRIC_WEIGHTS.refundPerformance +
    metrics.responseTime.score * SUPPLIER_METRIC_WEIGHTS.responseTime;

  const supplierScore = clampScore(weightedScore);

  const supplierRisk =
    supplierScore >= SUPPLIER_THRESHOLDS.lowRiskMinimumScore
      ? "low"
      : supplierScore >= SUPPLIER_THRESHOLDS.mediumRiskMinimumScore
        ? "medium"
        : "high";

  const availableMetrics = Object.values(metrics).filter(
    (metric) => metric.status !== "unavailable"
  );

  const verifiedMetrics = availableMetrics.filter(
    (metric) => metric.status === "verified"
  );

  const missingEvidence = Object.entries(metrics)
    .filter(([, metric]) => metric.status === "unavailable")
    .map(([name]) => name);

  const reasons: string[] = [];
  const warnings: string[] = [];

  if (metrics.stockStability.score >= 75) {
    reasons.push("Stock levels appear stable.");
  }

  if (metrics.priceStability.score >= 75) {
    reasons.push("Supplier pricing appears stable.");
  }

  if (metrics.deliveryTime.score >= 75) {
    reasons.push("Delivery performance is acceptable.");
  }

  if (metrics.stockStability.score < 50) {
    warnings.push("Stock availability is unstable.");
  }

  if (metrics.priceStability.score < 50) {
    warnings.push("Supplier pricing is volatile.");
  }

  if (metrics.orderAccuracy.score < 70) {
    warnings.push("Order accuracy requires review.");
  }

  const dataQuality =
    verifiedMetrics.length >= 5
      ? "verified"
      : availableMetrics.length >= 3
        ? "mixed"
        : "estimated";

  const sampleSize = Math.max(
    0,
    ...availableMetrics.map((metric) => metric.sampleSize)
  );

  return {
    supplierScore,
    supplierRisk,
    preferredSupplier:
      supplierScore >= SUPPLIER_THRESHOLDS.preferredMinimumScore &&
      supplierRisk === "low" &&
      dataQuality !== "estimated" &&
      sampleSize >= SUPPLIER_THRESHOLDS.minimumVerifiedSnapshots,

    metrics,
    reasons,
    warnings,
    missingEvidence,
    sampleSize,
    dataQuality,
    lastUpdated: new Date().toISOString(),
    engineVersion: SUPPLIER_ENGINE_VERSION,
  };
}
