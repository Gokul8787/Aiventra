import { describe, expect, it } from "vitest";

import { resolveActionConflicts } from "./actionConflictResolver";
import { evaluateRule, evaluateRules } from "./rulesEngine";
import { AutomationRule, RuleEvaluationContext } from "./types";

const context: RuleEvaluationContext = {
  organisationId: "org",
  storeId: "store",
  product: {
    id: "product-1",
    name: "Portable Blender",
    category: "Kitchen",
    supplier: "CJ Dropshipping",
    supplierPrice: 12,
    sellPrice: 34.99,
    shippingDays: 7,
    trendScore: 85,
    competitionScore: 40,
    profitMargin: 50,
    aiScore: 88,
    reason: "",
    stock: 150,
    decision: {
      decision: "PUBLISH",
      confidence: 91,
      risk: "low",
      automationAllowed: true,
      requiresHumanApproval: false,
      readiness: "READY",
      readinessBlockingReasons: [],
      reasons: [],
      blockers: [],
      warnings: [],
      engineVersion: "test",
      evaluatedAt: new Date().toISOString(),
    },
    costAnalysis: {
      calculationType: "estimated",
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
      profitScore: 75,
      financiallyViable: true,
      engineVersion: "test",
      calculatedAt: new Date().toISOString(),
    },
    supplierReliability: {
      supplierScore: 82,
      supplierRisk: "low",
      preferredSupplier: true,
      dataQuality: "verified",
      sampleSize: 10,
      reasons: [],
      warnings: [],
      missingEvidence: [],
      metrics: {
        deliveryTime: {
          score: 90,
          status: "verified",
          sampleSize: 10,
          reason: "Fast delivery.",
        },
        stockStability: {
          score: 85,
          status: "verified",
          sampleSize: 10,
          reason: "Stable stock.",
        },
        priceStability: {
          score: 80,
          status: "verified",
          sampleSize: 10,
          reason: "Stable price.",
        },
        shippingReliability: {
          score: 82,
          status: "verified",
          sampleSize: 10,
          reason: "Reliable shipping.",
        },
        orderAccuracy: {
          score: 90,
          status: "verified",
          sampleSize: 10,
          reason: "Accurate orders.",
        },
        refundPerformance: {
          score: 85,
          status: "verified",
          sampleSize: 10,
          reason: "Low refunds.",
        },
        responseTime: {
          score: 80,
          status: "verified",
          sampleSize: 10,
          reason: "Responsive supplier.",
        },
      },
      engineVersion: "test",
      lastUpdated: new Date().toISOString(),
    },
  },
  lifecycle: {
    stage: "AI_APPROVED",
    status: "ACTIVE",
  },
};

const baseRule: AutomationRule = {
  id: "rule-1",
  organisationId: "org",
  storeId: "store",
  name: "Generate listing",
  enabled: true,
  priority: 100,
  executionMode: "DRY_RUN",
  logicalOperator: "AND",
  conditions: [
    {
      field: "product.decision.decision",
      operator: "eq",
      value: "PUBLISH",
    },
  ],
  actions: [
    {
      type: "GENERATE_LISTING",
    },
  ],
  stopProcessing: false,
  version: 1,
};

describe("rulesEngine", () => {
  it("matches when all AND conditions match", () => {
    const result = evaluateRule(
      {
        ...baseRule,
        conditions: [
          ...baseRule.conditions,
          {
            field: "product.costAnalysis.netMarginPercent",
            operator: "gte",
            value: 25,
          },
        ],
      },
      context
    );

    expect(result.matched).toBe(true);
    expect(result.actions).toHaveLength(1);
  });

  it("fails when one AND condition fails", () => {
    const result = evaluateRule(
      {
        ...baseRule,
        conditions: [
          ...baseRule.conditions,
          {
            field: "product.stock",
            operator: "gte",
            value: 500,
          },
        ],
      },
      context
    );

    expect(result.matched).toBe(false);
    expect(result.actions).toHaveLength(0);
  });

  it("matches when one OR condition matches", () => {
    const result = evaluateRule(
      {
        ...baseRule,
        logicalOperator: "OR",
        conditions: [
          {
            field: "product.decision.decision",
            operator: "eq",
            value: "WATCH",
          },
          {
            field: "product.stock",
            operator: "gte",
            value: 100,
          },
        ],
      },
      context
    );

    expect(result.matched).toBe(true);
  });

  it("handles missing fields", () => {
    const result = evaluateRule(
      {
        ...baseRule,
        conditions: [
          {
            field: "inventory.daysOfStockRemaining",
            operator: "not_exists",
          },
        ],
      },
      context
    );

    expect(result.matched).toBe(true);
  });

  it("handles in and not_in operators", () => {
    const inResult = evaluateRule(
      {
        ...baseRule,
        conditions: [
          {
            field: "product.category",
            operator: "in",
            value: ["Kitchen", "Pet"],
          },
        ],
      },
      context
    );

    const notInResult = evaluateRule(
      {
        ...baseRule,
        conditions: [
          {
            field: "product.category",
            operator: "not_in",
            value: ["Fashion", "Beauty"],
          },
        ],
      },
      context
    );

    expect(inResult.matched).toBe(true);
    expect(notInResult.matched).toBe(true);
  });

  it("stopProcessing prevents lower-priority rules", () => {
    const results = evaluateRules(
      [
        {
          ...baseRule,
          id: "high",
          priority: 200,
          stopProcessing: true,
        },
        {
          ...baseRule,
          id: "low",
          priority: 100,
        },
      ],
      context
    );

    expect(results).toHaveLength(1);
    expect(results[0].ruleId).toBe("high");
  });

  it("conflicting actions resolve safely", () => {
    const resolved = resolveActionConflicts([
      {
        type: "INCREASE_AD_BUDGET",
      },
      {
        type: "PAUSE_ADVERTISING",
      },
      {
        type: "GENERATE_LISTING",
      },
    ]);

    expect(resolved.map((action) => action.type)).toEqual([
      "PAUSE_ADVERTISING",
      "GENERATE_LISTING",
    ]);
  });

  it("negative margin never creates a publishing action", () => {
    const result = evaluateRule(baseRule, {
      ...context,
      product: {
        ...context.product,
        costAnalysis: {
          ...context.product.costAnalysis!,
          netMarginPercent: -5,
        },
      },
    });

    expect(result.matched).toBe(true);
    expect(result.actions).toHaveLength(0);
  });

  it("retired products never return to publishing automatically", () => {
    const result = evaluateRule(baseRule, {
      ...context,
      lifecycle: {
        stage: "RETIRED",
        status: "ACTIVE",
      },
    });

    expect(result.matched).toBe(true);
    expect(result.actions).toHaveLength(0);
  });
});
