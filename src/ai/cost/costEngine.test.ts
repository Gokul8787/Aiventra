import assert from "node:assert/strict";
import { describe, it } from "vitest";

import { analyseProductCost } from "./costEngine";
import type { CostInput } from "./types";

function input(overrides: Partial<CostInput> = {}): CostInput {
  return {
    calculationType: "estimated",
    currency: "GBP",
    sellPrice: 34.99,
    supplierCost: 10,
    shippingCost: 3.99,
    paymentFeePercent: 2,
    paymentFeeFixed: 0.25,
    monthlyPlatformFee: 25,
    expectedMonthlyOrders: 250,
    advertisingCostPerOrder: 7,
    expectedReturnRatePercent: 5,
    currencyConversionFeePercent: 1.5,
    vatRatePercent: 0,
    pricesIncludeVat: true,
    otherCostsPerOrder: 0,
    ...overrides,
  };
}

describe("analyseProductCost", () => {
  it("calculates a profitable product", () => {
    const result = analyseProductCost(input());

    assert.ok(result.netProfit > 0);
    assert.equal(result.financiallyViable, true);
    assert.equal(
      result.netProfit,
      Number((result.revenue - result.totalCost).toFixed(2))
    );
  });

  it("marks supplier cost greater than selling price as unviable", () => {
    const result = analyseProductCost(
      input({
        sellPrice: 20,
        supplierCost: 25,
      })
    );

    assert.ok(result.netProfit < 0);
    assert.equal(result.financiallyViable, false);
  });

  it("handles zero monthly orders without platform division errors", () => {
    const result = analyseProductCost(
      input({
        expectedMonthlyOrders: 0,
      })
    );

    assert.equal(result.costs.platformFeeAllocation, 0);
  });

  it("calculates VAT reserve from VAT-inclusive prices", () => {
    const result = analyseProductCost(
      input({
        sellPrice: 120,
        vatRatePercent: 20,
        pricesIncludeVat: true,
      })
    );

    assert.equal(result.costs.vatReserve, 20);
  });

  it("reduces viability for high advertising CPA", () => {
    const result = analyseProductCost(
      input({
        advertisingCostPerOrder: 40,
      })
    );

    assert.ok(result.netProfit < 0);
    assert.equal(result.financiallyViable, false);
  });

  it("accounts for high return rate", () => {
    const standard = analyseProductCost(input());
    const highReturns = analyseProductCost(
      input({
        expectedReturnRatePercent: 25,
      })
    );

    assert.ok(highReturns.netProfit < standard.netProfit);
  });

  it("handles no shipping cost", () => {
    const result = analyseProductCost(
      input({
        shippingCost: 0,
      })
    );

    assert.equal(result.costs.shippingCost, 0);
  });

  it("calculates break-even ROAS from maximum affordable CPA", () => {
    const result = analyseProductCost(input());
    const expected =
      result.maximumAffordableCPA > 0
        ? Number((result.revenue / result.maximumAffordableCPA).toFixed(2))
        : 0;

    assert.equal(result.breakEvenROAS, expected);
  });

  it("accounts for currency fee", () => {
    const result = analyseProductCost(
      input({
        sellPrice: 100,
        currencyConversionFeePercent: 2,
      })
    );

    assert.equal(result.costs.currencyConversionFee, 2);
  });

  it("marks negative net profit as financially unviable", () => {
    const result = analyseProductCost(
      input({
        sellPrice: 12,
      })
    );

    assert.ok(result.netProfit < 0);
    assert.equal(result.financiallyViable, false);
  });
});
