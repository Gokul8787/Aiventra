import { describe, expect, it } from "vitest";

import { calculateOrderRefundStatus } from "./calculateRefundStatus";

describe("calculateOrderRefundStatus", () => {
  it("returns not_refunded with no refund", () => {
    expect(
      calculateOrderRefundStatus({
        orderTotal: 100,
        refundedTotal: 0,
        totalItemQuantity: 2,
        refundedItemQuantity: 0,
      }).status
    ).toBe("not_refunded");
  });

  it("returns partially_refunded for one item", () => {
    expect(
      calculateOrderRefundStatus({
        orderTotal: 100,
        refundedTotal: 40,
        totalItemQuantity: 2,
        refundedItemQuantity: 1,
      }).status
    ).toBe("partially_refunded");
  });

  it("returns refunded when the full amount is refunded", () => {
    expect(
      calculateOrderRefundStatus({
        orderTotal: 100,
        refundedTotal: 100,
        totalItemQuantity: 2,
        refundedItemQuantity: 1,
      }).status
    ).toBe("refunded");
  });

  it("returns refunded when all quantities are refunded", () => {
    expect(
      calculateOrderRefundStatus({
        orderTotal: 100,
        refundedTotal: 90,
        totalItemQuantity: 2,
        refundedItemQuantity: 2,
      }).status
    ).toBe("refunded");
  });

  it("returns partially_refunded for shipping-only refund", () => {
    expect(
      calculateOrderRefundStatus({
        orderTotal: 100,
        refundedTotal: 5,
        totalItemQuantity: 2,
        refundedItemQuantity: 0,
      }).status
    ).toBe("partially_refunded");
  });
});
