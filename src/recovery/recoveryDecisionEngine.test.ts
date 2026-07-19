import { describe, expect, it } from "vitest";

import { analyseCancellationRecovery } from "./recoveryDecisionEngine";
import type { RecoveryContext } from "./types";

function buildContext(
  overrides: Partial<RecoveryContext> = {}
): RecoveryContext {
  return {
    order: {
      id: "order-1",
      status: "cancelled",
      paid: false,
      cancelled: true,
      partiallyRefunded: false,
      fullyRefunded: false,
      ...(overrides.order || {}),
    },
    supplierOrder: overrides.supplierOrder,
    platformFulfilment: overrides.platformFulfilment,
    queuedJobs: overrides.queuedJobs || [],
  };
}

describe("analyseCancellationRecovery", () => {
  it("cancels queued work when there is no external work", () => {
    const result = analyseCancellationRecovery(buildContext());

    expect(result.decision).toBe("CANCEL_QUEUED_WORK");
    expect(result.automaticExecutionAllowed).toBe(true);
  });

  it("auto-cancels an unpaid supplier order", () => {
    const result = analyseCancellationRecovery(
      buildContext({
        supplierOrder: {
          id: "supplier-1",
          provider: "cj",
          externalOrderId: "ext-1",
          status: "CREATED",
        },
      })
    );

    expect(result.decision).toBe("CANCEL_SUPPLIER_ORDER");
    expect(result.automaticExecutionAllowed).toBe(true);
  });

  it("requires manual review for paid supplier orders", () => {
    const result = analyseCancellationRecovery(
      buildContext({
        supplierOrder: {
          id: "supplier-1",
          provider: "cj",
          externalOrderId: "ext-1",
          status: "PAID",
        },
      })
    );

    expect(result.decision).toBe("MANUAL_REVIEW");
    expect(result.automaticExecutionAllowed).toBe(false);
  });

  it("marks shipped supplier orders as too late", () => {
    const result = analyseCancellationRecovery(
      buildContext({
        supplierOrder: {
          id: "supplier-1",
          provider: "cj",
          externalOrderId: "ext-1",
          status: "SHIPPED",
          trackingNumber: "TRACK123",
        },
      })
    );

    expect(result.decision).toBe("TOO_LATE");
    expect(result.blockers).toContain(
      "The supplier shipment has already started or completed."
    );
  });

  it("requires platform review when a fulfilment exists", () => {
    const result = analyseCancellationRecovery(
      buildContext({
        platformFulfilment: {
          id: "fulfilment-1",
          platform: "shopify",
          externalFulfilmentId: "gid://shopify/Fulfillment/1",
          status: "fulfilled",
        },
      })
    );

    expect(result.decision).toBe("CANCEL_PLATFORM_FULFILMENT");
    expect(result.automaticExecutionAllowed).toBe(false);
  });
});
