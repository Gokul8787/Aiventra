import {
  DecisionReason,
  DecisionRisk,
  ProductDecision,
  ProductDecisionInput,
  ProductDecisionResult,
} from "./types";
import {
  DEFAULT_DECISION_THRESHOLDS,
  DecisionThresholds,
} from "./config";

const ENGINE_VERSION = "1.0.0";
const MINIMUM_AUTOMATION_DATA_QUALITY = 85;

function clampScore(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

export function evaluateProductDecision(
  input: ProductDecisionInput,
  thresholds: DecisionThresholds = DEFAULT_DECISION_THRESHOLDS
): ProductDecisionResult {
  const { product, intelligence } = input;

  const reasons: DecisionReason[] = [];
  const blockers: string[] = [];
  const warnings: string[] = [];

  const demandScore = intelligence.demand.demandScore;
  const competitionScore =
    intelligence.competition.competitionOpportunityScore;
  const profitScore = intelligence.profit.profitScore;
  const shippingScore = intelligence.shipping.shippingScore;
  const supplierScore = intelligence.supplier.supplierScore;
  const reviewScore = intelligence.reviews.reviewScore;
  const seasonalityScore = intelligence.seasonality.seasonalityScore;
  const confidenceScore = intelligence.confidence.confidenceScore;
  const confidenceCompleteness = intelligence.confidence.completenessScore;
  const confidenceSourceCount = intelligence.confidence.sourceCount;
  const conflictingMetrics = intelligence.confidence.conflictingMetrics;
  const overallScore = intelligence.overallScore;

  if (demandScore >= 75) {
    reasons.push({
      code: "STRONG_DEMAND",
      message: "Demand indicators are strong.",
      impact: "positive",
    });
  } else if (demandScore < 45) {
    blockers.push("Demand is too weak.");
    reasons.push({
      code: "WEAK_DEMAND",
      message: "Demand indicators are weak.",
      impact: "negative",
    });
  }

  if (profitScore >= 70) {
    reasons.push({
      code: "STRONG_PROFIT",
      message: "Estimated profitability is attractive.",
      impact: "positive",
    });
  } else if (profitScore < 45) {
    blockers.push("Estimated profitability is too low.");
    reasons.push({
      code: "LOW_PROFIT",
      message: "Estimated profitability is weak.",
      impact: "negative",
    });
  }

  if (shippingScore >= 70) {
    reasons.push({
      code: "ACCEPTABLE_SHIPPING",
      message: "Shipping performance is acceptable.",
      impact: "positive",
    });
  } else if (shippingScore < 45) {
    blockers.push("Shipping performance is unacceptable.");
    reasons.push({
      code: "POOR_SHIPPING",
      message: "Shipping time or cost creates high risk.",
      impact: "negative",
    });
  }

  if (supplierScore >= 75) {
    reasons.push({
      code: "RELIABLE_SUPPLIER",
      message: "Supplier reliability is strong.",
      impact: "positive",
    });
  } else if (supplierScore < 50) {
    blockers.push("Supplier reliability is too low.");
    reasons.push({
      code: "SUPPLIER_RISK",
      message: "Supplier reliability requires review.",
      impact: "negative",
    });
  }

  if (competitionScore < 40) {
    warnings.push("Competition is high.");
    reasons.push({
      code: "HIGH_COMPETITION",
      message: "The market appears highly competitive.",
      impact: "negative",
    });
  } else {
    reasons.push({
      code: "COMPETITION_MANAGEABLE",
      message: "Competition appears manageable.",
      impact: "positive",
    });
  }

  if (reviewScore < 50) {
    warnings.push("Review evidence is weak.");
  }

  if (seasonalityScore < 50) {
    warnings.push("Seasonality may limit current demand.");
  }

  if (product.stock !== undefined && product.stock <= 0) {
    blockers.push("Product is out of stock.");
  } else if (product.stock !== undefined && product.stock < 20) {
    warnings.push("Supplier stock is low.");
  }

  const cost = product.costAnalysis;

  if (!cost) {
    blockers.push("Financial cost analysis is missing.");
  } else {
    if (cost.netProfit <= 0) {
      blockers.push("Estimated net profit is not positive.");
    }

    if (cost.netMarginPercent < 15) {
      blockers.push("Estimated net margin is below 15%.");
    }

    if (cost.maximumAffordableCPA <= 0) {
      blockers.push("The product cannot support advertising cost.");
    }

    if (cost.breakEvenROAS > 5) {
      warnings.push("Required break-even ROAS is high.");
    }

    if (cost.roiPercent >= 50) {
      reasons.push({
        code: "STRONG_ESTIMATED_ROI",
        message: "Estimated return on cost is strong.",
        impact: "positive",
      });
    }
  }

  const supplier = product.supplierReliability;

  if (!supplier) {
    blockers.push("Supplier reliability analysis is missing.");
  } else {
    if (supplier.supplierRisk === "high") {
      blockers.push("Supplier reliability risk is high.");
    }

    if (supplier.dataQuality === "estimated") {
      warnings.push("Supplier reliability is based on limited evidence.");
    }

    if (supplier.preferredSupplier) {
      reasons.push({
        code: "PREFERRED_SUPPLIER",
        message: "The supplier meets preferred reliability criteria.",
        impact: "positive",
      });
    }
  }

  const dataQuality = intelligence.dataQuality?.status ?? "estimated";
  const verification = intelligence.verification;
  const verificationStatus = verification?.status ?? "missing";
  const readinessBlockingReasons: string[] = [];

  if (dataQuality !== "verified") {
    warnings.push(`Intelligence data quality is ${dataQuality}.`);
  }

  if (!verification || verification.status !== "verified") {
    readinessBlockingReasons.push(
      `Evidence verification is ${verificationStatus}.`
    );
  }

  if ((verification?.dataQuality ?? 0) < MINIMUM_AUTOMATION_DATA_QUALITY) {
    readinessBlockingReasons.push(
      `Evidence data quality is below ${MINIMUM_AUTOMATION_DATA_QUALITY}.`
    );
  }

  const requiredFulfilmentEvidence = [
    verification?.byCategory.product_cost?.status,
    verification?.byCategory.inventory?.status,
    verification?.byCategory.shipping?.status,
  ];

  if (requiredFulfilmentEvidence.some((status) => status !== "verified")) {
    readinessBlockingReasons.push(
      "Supplier fulfilment evidence is incomplete."
    );
  }

  readinessBlockingReasons.push(
    ...(verification?.blockingReasons.slice(0, 5) || [])
  );

  if (confidenceScore < 45) {
    blockers.push("Decision confidence is too low.");
  }

  if (confidenceCompleteness < 50) {
    blockers.push("Insufficient evidence coverage.");
  }

  if (conflictingMetrics.length > 1) {
    warnings.push("Multiple market signals conflict.");
  } else if (conflictingMetrics.length === 1) {
    warnings.push(`Conflicting ${conflictingMetrics[0]} evidence detected.`);
  }

  let decision: ProductDecision;

  const qualifiesForPublish =
    overallScore >= thresholds.publish.minimumOverallScore &&
    confidenceScore >= thresholds.publish.minimumConfidence &&
    profitScore >= thresholds.publish.minimumProfitScore &&
    shippingScore >= thresholds.publish.minimumShippingScore &&
    supplierScore >= thresholds.publish.minimumSupplierScore &&
    demandScore >= thresholds.publish.minimumDemandScore &&
    competitionScore >= thresholds.publish.minimumCompetitionOpportunity &&
    blockers.length === 0;

  const qualifiesForBuy =
    overallScore >= thresholds.buy.minimumOverallScore &&
    confidenceScore >= thresholds.buy.minimumConfidence &&
    blockers.length === 0;

  if (blockers.length > 0) {
    decision =
      overallScore >= thresholds.watch.minimumOverallScore
        ? "REVIEW"
        : "IGNORE";
  } else if (qualifiesForPublish) {
    decision = "PUBLISH";
  } else if (qualifiesForBuy) {
    decision = "BUY";
  } else if (overallScore >= thresholds.watch.minimumOverallScore) {
    decision = "WATCH";
  } else {
    decision = "IGNORE";
  }

  const evidenceScores = [
    overallScore,
    confidenceScore,
    demandScore,
    profitScore,
    shippingScore,
    supplierScore,
    reviewScore,
  ];

  const averageEvidence =
    evidenceScores.reduce((sum, value) => sum + value, 0) /
    evidenceScores.length;

  let decisionConfidence = averageEvidence;
  const memory = product.memory;

  if (dataQuality === "estimated") {
    decisionConfidence -= 20;
  } else if (dataQuality === "mixed") {
    decisionConfidence -= 10;
  }

  decisionConfidence -= blockers.length * 8;
  decisionConfidence -= warnings.length * 2;

  if (memory) {
    const trendGrowth =
      memory.trendHistory.length >= 2
        ? memory.trendHistory[memory.trendHistory.length - 1] -
          memory.trendHistory[0]
        : 0;
    const memoryConfidenceBoost = Math.min(6, Math.floor(memory.timesSeen / 5));
    const salesBoost = Math.min(8, Math.floor(memory.timesSold / 20));
    const recommendationBoost = Math.min(
      4,
      Math.floor(memory.timesRecommended / 3)
    );
    const trendBoost = trendGrowth >= 15 ? 4 : trendGrowth >= 5 ? 2 : 0;
    const supplierChangePenalty = Math.min(8, memory.supplierChanges * 2);

    if (memory.timesSeen >= 5) {
      reasons.push({
        code: "MEMORY_REPEAT_OBSERVATION",
        message: `Product has been observed ${memory.timesSeen} times.`,
        impact: "positive",
      });
    }

    if (memory.timesSold > 0) {
      reasons.push({
        code: "MEMORY_PREVIOUS_SALES",
        message: `Product memory shows ${memory.timesSold} prior sales.`,
        impact: "positive",
      });
    }

    if (trendBoost > 0) {
      reasons.push({
        code: "MEMORY_TREND_IMPROVING",
        message: `Product trend has improved by ${trendGrowth} points over memory history.`,
        impact: "positive",
      });
    }

    if (memory.supplierChanges >= 2) {
      warnings.push("Product memory shows repeated supplier changes.");
      reasons.push({
        code: "MEMORY_SUPPLIER_VOLATILITY",
        message: "Supplier history has changed multiple times.",
        impact: "negative",
      });
    }

    decisionConfidence +=
      memoryConfidenceBoost + salesBoost + recommendationBoost + trendBoost;
    decisionConfidence -= supplierChangePenalty;
  }

  const confidence = clampScore(decisionConfidence);

  const risk: DecisionRisk =
    blockers.length > 0 || confidence < 50
      ? "high"
      : warnings.length > 1 || confidence < 75
        ? "medium"
        : "low";

  const automationAllowed =
    decision === "PUBLISH" &&
    confidenceScore >= 85 &&
    verificationStatus === "verified" &&
    (verification?.dataQuality ?? 0) >= MINIMUM_AUTOMATION_DATA_QUALITY &&
    cost?.financiallyViable === true &&
    supplier?.supplierRisk === "low" &&
    supplier.preferredSupplier === true &&
    supplier.dataQuality !== "estimated" &&
    confidence >= thresholds.automation.minimumConfidence &&
    dataQuality === "verified" &&
    confidenceSourceCount >= 3 &&
    conflictingMetrics.length === 0 &&
    blockers.length === 0 &&
    readinessBlockingReasons.length === 0 &&
    (thresholds.automation.allowEstimatedData || dataQuality === "verified");
  const readiness = readinessBlockingReasons.length === 0 ? "READY" : "NOT_READY";

  return {
    decision,
    confidence,
    risk,
    reasons,
    blockers,
    warnings,
    automationAllowed,
    requiresHumanApproval: !automationAllowed,
    readiness,
    readinessBlockingReasons,
    evaluatedAt: new Date().toISOString(),
    engineVersion: ENGINE_VERSION,
  };
}
