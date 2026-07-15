import { describe, expect, it } from "vitest";

import {
  evaluateFulfilmentCheck,
  getFinalFulfilmentDecision,
} from "./evaluator";
import type {
  FulfilmentOrderItemInput,
  FulfilmentSupplierEvidence,
  FulfilmentSupplierMappingInput,
} from "./types";

const now = "2026-07-15T00:00:00.000Z";

function orderItem(
  overrides: Partial<FulfilmentOrderItemInput> = {}
): FulfilmentOrderItemInput {
  return {
    id: "order-item-1",
    productId: "product-1",
    quantity: 1,
    unitPrice: 30,
    originalUnitCost: 10,
    ...overrides,
  };
}

function mapping(
  overrides: Partial<FulfilmentSupplierMappingInput> = {}
): FulfilmentSupplierMappingInput {
  return {
    id: "mapping-1",
    supplierAccountId: "supplier-account-1",
    preferred: true,
    ...overrides,
  };
}

function evidence(
  overrides: Partial<FulfilmentSupplierEvidence> = {}
): FulfilmentSupplierEvidence {
  return {
    inventory: {
      available: true,
      availableQuantity: 25,
      checkedAt: now,
    },
    pricing: {
      unitCost: 10,
      currency: "GBP",
      checkedAt: now,
    },
    shipping: {
      checkedAt: now,
      options: [
        {
          id: "shipping-1",
          name: "Tracked",
          cost: 4,
          currency: "GBP",
          deliveryDaysMin: 6,
          deliveryDaysMax: 9,
          trackingAvailable: true,
        },
      ],
    },
    ...overrides,
  };
}

describe("evaluateFulfilmentCheck", () => {
  it("blocks order items without an Aiventra product mapping", () => {
    const result = evaluateFulfilmentCheck({
      orderItem: orderItem({ productId: undefined }),
    });

    expect(result.decision).toBe("BLOCKED");
    expect(result.blockers).toContain(
      "The Shopify order item is not mapped to an Aiventra product."
    );
  });

  it("blocks order items without a supplier mapping", () => {
    const result = evaluateFulfilmentCheck({
      orderItem: orderItem(),
    });

    expect(result.decision).toBe("BLOCKED");
    expect(result.blockers).toContain(
      "No active supplier mapping exists for this product."
    );
  });

  it("blocks out-of-stock supplier products", () => {
    const result = evaluateFulfilmentCheck({
      orderItem: orderItem(),
      mapping: mapping(),
      evidence: evidence({
        inventory: {
          available: false,
          availableQuantity: 0,
          checkedAt: now,
        },
      }),
    });

    expect(result.decision).toBe("BLOCKED");
    expect(result.blockers).toContain(
      "The supplier does not have sufficient stock."
    );
  });

  it("blocks when no shipping option meets configured limits", () => {
    const result = evaluateFulfilmentCheck({
      orderItem: orderItem(),
      mapping: mapping(),
      evidence: evidence({
        shipping: {
          checkedAt: now,
          options: [
            {
              id: "slow",
              name: "Slow",
              cost: 15,
              currency: "GBP",
              deliveryDaysMax: 21,
              trackingAvailable: true,
            },
          ],
        },
      }),
    });

    expect(result.decision).toBe("BLOCKED");
    expect(result.blockers).toContain(
      "No shipping option meets the configured cost and delivery limits."
    );
  });

  it("blocks negative updated margin", () => {
    const result = evaluateFulfilmentCheck({
      orderItem: orderItem({ unitPrice: 12 }),
      mapping: mapping(),
      evidence: evidence({
        pricing: {
          unitCost: 15,
          currency: "GBP",
          checkedAt: now,
        },
      }),
    });

    expect(result.decision).toBe("BLOCKED");
    expect(result.blockers).toContain(
      "Updated net margin is below the fulfilment threshold."
    );
  });

  it("sends non-preferred supplier mappings to manual review", () => {
    const result = evaluateFulfilmentCheck({
      orderItem: orderItem(),
      mapping: mapping({ preferred: false }),
      evidence: evidence(),
    });

    expect(result.decision).toBe("MANUAL_REVIEW");
    expect(result.warnings).toContain(
      "The selected supplier mapping is not marked as preferred."
    );
  });

  it("sends supplier price increases above tolerance to manual review", () => {
    const result = evaluateFulfilmentCheck({
      orderItem: orderItem({ originalUnitCost: 10 }),
      mapping: mapping(),
      evidence: evidence({
        pricing: {
          unitCost: 12,
          currency: "GBP",
          checkedAt: now,
        },
      }),
    });

    expect(result.decision).toBe("MANUAL_REVIEW");
    expect(result.warnings[0]).toContain("Supplier cost increased");
  });

  it("auto-fulfils good stock, price and shipping", () => {
    const result = evaluateFulfilmentCheck({
      orderItem: orderItem(),
      mapping: mapping(),
      evidence: evidence(),
    });

    expect(result.decision).toBe("AUTO_FULFIL");
    expect(result.estimatedNetProfit).toBe(16);
    expect(result.estimatedNetMarginPercent).toBe(53.33);
  });
});

describe("getFinalFulfilmentDecision", () => {
  it("blocks a full order when one item is blocked", () => {
    expect(getFinalFulfilmentDecision(["AUTO_FULFIL", "BLOCKED"])).toBe(
      "BLOCKED"
    );
  });

  it("sends a full order to manual review when one item needs review", () => {
    expect(
      getFinalFulfilmentDecision(["AUTO_FULFIL", "MANUAL_REVIEW"])
    ).toBe("MANUAL_REVIEW");
  });

  it("auto-fulfils a full order when all items pass", () => {
    expect(getFinalFulfilmentDecision(["AUTO_FULFIL", "AUTO_FULFIL"])).toBe(
      "AUTO_FULFIL"
    );
  });
});
