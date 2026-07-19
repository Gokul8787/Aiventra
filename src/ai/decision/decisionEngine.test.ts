import { describe, expect, it } from "vitest";

import type { Product } from "@/ai/types/product";
import type { ProductIntelligence } from "@/ai/intelligence/productIntelligenceTypes";
import { evaluateProductDecision } from "./decisionEngine";

function buildProduct(): Product {
  return {
    id: "product-1",
    name: "Portable Blender",
    category: "Kitchen",
    supplier: "CJ Dropshipping",
    supplierPrice: 12,
    sellPrice: 34.99,
    shippingDays: 7,
    trendScore: 85,
    competitionScore: 35,
    profitMargin: 50,
    aiScore: 88,
    reason: "",
    stock: 120,
    costAnalysis: {
      calculationType: "actual",
      currency: "GBP",
      revenue: 34.99,
      costs: {
        supplierCost: 12,
        shippingCost: 3.99,
        paymentFee: 1,
        platformFeeAllocation: 1,
        advertisingCost: 6,
        returnAllowance: 1,
        currencyConversionFee: 0,
        vatReserve: 0,
        otherCosts: 0,
      },
      totalNonAdvertisingCost: 18.99,
      totalCost: 24.99,
      grossProfit: 19,
      preAdvertisingProfit: 16,
      netProfit: 10,
      grossMarginPercent: 54,
      netMarginPercent: 28,
      roiPercent: 40,
      breakEvenROAS: 3,
      maximumAffordableCPA: 10,
      profitScore: 82,
      financiallyViable: true,
      engineVersion: "test",
      calculatedAt: new Date().toISOString(),
    },
    supplierReliability: {
      supplierScore: 90,
      supplierRisk: "low",
      preferredSupplier: true,
      dataQuality: "verified",
      sampleSize: 12,
      reasons: [],
      warnings: [],
      missingEvidence: [],
      metrics: {
        deliveryTime: {
          score: 90,
          status: "verified",
          sampleSize: 12,
          reason: "Good delivery time.",
        },
        stockStability: {
          score: 88,
          status: "verified",
          sampleSize: 12,
          reason: "Stable stock.",
        },
        priceStability: {
          score: 86,
          status: "verified",
          sampleSize: 12,
          reason: "Stable price.",
        },
        shippingReliability: {
          score: 85,
          status: "verified",
          sampleSize: 12,
          reason: "Reliable shipping.",
        },
        orderAccuracy: {
          score: 92,
          status: "verified",
          sampleSize: 12,
          reason: "Accurate orders.",
        },
        refundPerformance: {
          score: 88,
          status: "verified",
          sampleSize: 12,
          reason: "Healthy refund rate.",
        },
        responseTime: {
          score: 84,
          status: "verified",
          sampleSize: 12,
          reason: "Good response time.",
        },
      },
      engineVersion: "test",
      lastUpdated: new Date().toISOString(),
    },
  };
}

function buildIntelligence(): ProductIntelligence {
  return {
    demand: {
      demandScore: 86,
      demandRisk: "low",
      reason: "Strong demand.",
    },
    competition: {
      competitionOpportunityScore: 72,
      competitionRisk: "low",
      reason: "Manageable competition.",
    },
    profit: {
      grossProfit: 19,
      netProfit: 10,
      margin: 28,
      roi: 40,
      breakEvenROAS: 3,
      recommendedSellPrice: 34.99,
      profitScore: 82,
    },
    shipping: {
      shippingScore: 80,
      shippingRisk: "low",
      reason: "Good shipping.",
    },
    supplier: {
      supplierScore: 90,
      supplierRisk: "low",
      reason: "Strong supplier.",
    },
    reviews: {
      reviewScore: 75,
      reviewRisk: "low",
      reason: "Good reviews.",
    },
    seasonality: {
      seasonalityScore: 78,
      seasonalityRisk: "low",
      reason: "In season.",
    },
    confidence: {
      confidenceScore: 88,
      confidenceRisk: "low",
      evidenceCount: 8,
      verifiedEvidenceCount: 6,
      sourceCount: 3,
      completenessScore: 90,
      freshnessScore: 90,
      reliabilityScore: 88,
      agreementScore: 84,
      missingMetrics: [],
      conflictingMetrics: [],
      reason: "Confidence is strong.",
    },
    engineOutputs: {},
    overallScore: 86,
    dataQuality: {
      status: "verified",
      estimatedFields: [],
    },
    verification: {
      status: "mixed",
      dataQuality: 92,
      evidenceCount: 8,
      verifiedCount: 6,
      sourceCount: 3,
      freshnessScore: 90,
      coverageScore: 88,
      byCategory: {
        product_cost: {
          category: "product_cost",
          status: "verified",
          dataQuality: 95,
          evidenceCount: 1,
          verifiedCount: 1,
          sourceCount: 1,
          freshnessScore: 100,
          providers: ["cj"],
          blockingReasons: [],
        },
        inventory: {
          category: "inventory",
          status: "estimated",
          dataQuality: 45,
          evidenceCount: 1,
          verifiedCount: 0,
          sourceCount: 1,
          freshnessScore: 100,
          providers: ["cj"],
          blockingReasons: ["Inventory still estimated."],
        },
        shipping: {
          category: "shipping",
          status: "verified",
          dataQuality: 95,
          evidenceCount: 1,
          verifiedCount: 1,
          sourceCount: 1,
          freshnessScore: 100,
          providers: ["cj"],
          blockingReasons: [],
        },
      },
      blockingReasons: ["Inventory still estimated."],
      generatedAt: new Date().toISOString(),
    },
  };
}

describe("evaluateProductDecision", () => {
  it("blocks automation when supplier fulfilment evidence is incomplete", () => {
    const result = evaluateProductDecision({
      product: buildProduct(),
      intelligence: buildIntelligence(),
    });

    expect(result.decision).toBe("PUBLISH");
    expect(result.automationAllowed).toBe(false);
    expect(result.requiresHumanApproval).toBe(true);
    expect(result.readiness).toBe("NOT_READY");
    expect(result.readinessBlockingReasons).toContain(
      "Supplier fulfilment evidence is incomplete."
    );
  });
});
