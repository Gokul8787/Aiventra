import assert from "node:assert/strict";
import { describe, it } from "vitest";

import { analyseSupplierReliability } from "./supplierReliabilityEngine";
import type { SupplierSnapshot } from "./types";

function snapshot(overrides: Partial<SupplierSnapshot> = {}): SupplierSnapshot {
  return {
    provider: "cj",
    supplierId: "supplier-a",
    externalProductId: "product-a",
    supplierPrice: 10,
    stock: 100,
    quotedDeliveryDays: 7,
    shippingCost: 3.99,
    observedAt: new Date().toISOString(),
    ...overrides,
  };
}

function stableSnapshots(count: number): SupplierSnapshot[] {
  return Array.from({ length: count }, (_, index) =>
    snapshot({
      supplierPrice: 10 + (index % 2) * 0.1,
      stock: 95 + index,
      quotedDeliveryDays: 7,
      actualDeliveryDays: 7,
      orderAccurate: true,
      refunded: false,
      supplierResponseHours: 2,
      observedAt: new Date(Date.now() - index * 86_400_000).toISOString(),
    })
  );
}

describe("analyseSupplierReliability", () => {
  it("scores stable prices and stock well", () => {
    const result = analyseSupplierReliability(stableSnapshots(6));

    assert.ok(result.metrics.priceStability.score >= 90);
    assert.ok(result.metrics.stockStability.score >= 75);
  });

  it("penalizes volatile prices", () => {
    const result = analyseSupplierReliability([
      snapshot({ supplierPrice: 10 }),
      snapshot({ supplierPrice: 18 }),
      snapshot({ supplierPrice: 7 }),
      snapshot({ supplierPrice: 20 }),
    ]);

    assert.ok(result.metrics.priceStability.score < 50);
  });

  it("penalizes repeated stock-outs", () => {
    const result = analyseSupplierReliability([
      snapshot({ stock: 0 }),
      snapshot({ stock: 0 }),
      snapshot({ stock: 15 }),
      snapshot({ stock: 0 }),
      snapshot({ stock: 20 }),
    ]);

    assert.ok(result.metrics.stockStability.score < 50);
  });

  it("scores fast delivery highly", () => {
    const result = analyseSupplierReliability([
      snapshot({ actualDeliveryDays: 4 }),
      snapshot({ actualDeliveryDays: 5 }),
      snapshot({ actualDeliveryDays: 4 }),
    ]);

    assert.ok(result.metrics.deliveryTime.score >= 90);
  });

  it("scores slow delivery poorly", () => {
    const result = analyseSupplierReliability([
      snapshot({ actualDeliveryDays: 22 }),
      snapshot({ actualDeliveryDays: 24 }),
      snapshot({ actualDeliveryDays: 21 }),
    ]);

    assert.ok(result.metrics.deliveryTime.score <= 10);
  });

  it("detects quoted versus actual delivery mismatch", () => {
    const result = analyseSupplierReliability([
      snapshot({ quotedDeliveryDays: 7, actualDeliveryDays: 12 }),
      snapshot({ quotedDeliveryDays: 7, actualDeliveryDays: 11 }),
      snapshot({ quotedDeliveryDays: 7, actualDeliveryDays: 7 }),
    ]);

    assert.ok(result.metrics.shippingReliability.score < 50);
  });

  it("scores high order accuracy well", () => {
    const result = analyseSupplierReliability(stableSnapshots(10));

    assert.equal(result.metrics.orderAccuracy.score, 100);
  });

  it("penalizes high refund rate", () => {
    const result = analyseSupplierReliability([
      ...stableSnapshots(5).map((item) => ({ ...item, refunded: true })),
      ...stableSnapshots(5).map((item) => ({ ...item, refunded: false })),
    ]);

    assert.equal(result.metrics.refundPerformance.score, 50);
  });

  it("does not verify a new supplier with one snapshot", () => {
    const result = analyseSupplierReliability([snapshot()]);

    assert.equal(result.dataQuality, "estimated");
    assert.equal(result.preferredSupplier, false);
  });

  it("requires sufficient evidence before preferred supplier status", () => {
    const thinResult = analyseSupplierReliability([
      snapshot({
        actualDeliveryDays: 5,
        orderAccurate: true,
        refunded: false,
        supplierResponseHours: 2,
      }),
    ]);
    const matureResult = analyseSupplierReliability(stableSnapshots(12));

    assert.equal(thinResult.preferredSupplier, false);
    assert.equal(matureResult.preferredSupplier, true);
  });
});
