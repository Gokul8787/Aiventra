import { describe, expect, it } from "vitest";

import { mapCJOrderStatus } from "./mapCJOrderStatus";

describe("mapCJOrderStatus", () => {
  it("maps awaiting payment states to unpaid supplier orders", () => {
    expect(mapCJOrderStatus("Awaiting Payment", undefined)).toEqual({
      status: "AWAITING_PAYMENT",
      paymentStatus: "UNPAID",
    });
  });

  it("keeps paid orders paid when remote payment status is omitted", () => {
    expect(mapCJOrderStatus("Paid", undefined)).toEqual({
      status: "PAID",
      paymentStatus: "PAID",
    });
  });

  it("maps shipped orders with explicit payment status", () => {
    expect(mapCJOrderStatus("Shipped", "Paid")).toEqual({
      status: "SHIPPED",
      paymentStatus: "PAID",
    });
  });

  it("treats cancellation and payment failure independently", () => {
    expect(mapCJOrderStatus("Cancelled", "Payment Failed")).toEqual({
      status: "CANCELLED",
      paymentStatus: "PAYMENT_FAILED",
    });
  });

  it("falls back to unknown when the remote status is not recognized", () => {
    expect(mapCJOrderStatus("Mystery State", "Mystery Payment")).toEqual({
      status: "UNKNOWN",
      paymentStatus: "UNKNOWN",
    });
  });
});
