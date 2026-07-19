import { beforeEach, describe, expect, it, vi } from "vitest";

import type { TenantContext } from "@/context/storeContext";

vi.mock("server-only", () => ({}));

const { mocks } = vi.hoisted(() => ({
  mocks: {
    getCancellationRequestById: vi.fn(),
    getRecoveryContext: vi.fn(),
    saveRecoveryAnalysis: vi.fn(),
    cancelPendingOrderWork: vi.fn(),
    updateCancellationRequest: vi.fn(),
    publishEvent: vi.fn(),
    escalateRecoveryFailure: vi.fn(),
    createQueuedJob: vi.fn(),
    enqueueJobMessage: vi.fn(),
    saveQueueMessageId: vi.fn(),
    appendJobLog: vi.fn(),
  },
}));

vi.mock("@/services/repositories/cancellationRepository", () => ({
  getCancellationRequestById: mocks.getCancellationRequestById,
  updateCancellationRequest: mocks.updateCancellationRequest,
}));
vi.mock("@/services/recovery/getRecoveryContext", () => ({
  getRecoveryContext: mocks.getRecoveryContext,
}));
vi.mock("@/services/repositories/recoveryRepository", () => ({
  saveRecoveryAnalysis: mocks.saveRecoveryAnalysis,
}));
vi.mock("@/services/recovery/cancelPendingOrderWork", () => ({
  cancelPendingOrderWork: mocks.cancelPendingOrderWork,
}));
vi.mock("@/services/events/eventRepository", () => ({
  publishEvent: mocks.publishEvent,
}));
vi.mock("@/services/recovery/escalateRecoveryFailure", () => ({
  escalateRecoveryFailure: mocks.escalateRecoveryFailure,
}));
vi.mock("@/services/repositories/backgroundJobRepository", () => ({
  createQueuedJob: mocks.createQueuedJob,
  saveQueueMessageId: mocks.saveQueueMessageId,
  appendJobLog: mocks.appendJobLog,
}));
vi.mock("@/services/queues/jobQueue", () => ({
  enqueueJobMessage: mocks.enqueueJobMessage,
}));

import { orchestrateCancellation } from "./orchestrateCancellation";

const tenantContext: TenantContext = {
  organisationId: "org-1",
  storeId: "store-1",
  timezone: "Europe/London",
  currency: "GBP",
  locale: "en-GB",
};

function buildCancellationRequest() {
  return {
    id: "cancel-1",
    order_id: "order-1",
  };
}

function buildRecoveryContext(overrides: Record<string, unknown> = {}) {
  return {
    order: {
      id: "order-1",
      status: "cancelled",
      paid: false,
      cancelled: true,
      partiallyRefunded: false,
      fullyRefunded: false,
    },
    supplierOrder: undefined,
    platformFulfilment: undefined,
    queuedJobs: [],
    ...overrides,
  };
}

describe("orchestrateCancellation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getCancellationRequestById.mockResolvedValue(buildCancellationRequest());
    mocks.cancelPendingOrderWork.mockResolvedValue({
      cancelledJobIds: ["job-1", "job-2", "job-3"],
    });
    mocks.createQueuedJob.mockResolvedValue({
      id: "job-recovery-1",
      queueMessageId: 41,
      status: "queued",
    });
  });

  it("cancels queued work and completes when no supplier order exists", async () => {
    mocks.getRecoveryContext.mockResolvedValue(buildRecoveryContext());

    const result = await orchestrateCancellation({
      tenantContext,
      cancellationRequestId: "cancel-1",
    });

    expect(mocks.cancelPendingOrderWork).toHaveBeenCalledWith(
      expect.objectContaining({
        orderId: "order-1",
      })
    );
    expect(mocks.updateCancellationRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        cancellationRequestId: "cancel-1",
        status: "completed",
      })
    );
    expect(mocks.publishEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: "CancellationCompleted",
      })
    );
    expect(result.status).toBe("completed");
  });

  it("queues supplier cancellation automatically for awaiting-payment supplier orders", async () => {
    mocks.getRecoveryContext.mockResolvedValue(
      buildRecoveryContext({
        supplierOrder: {
          id: "supplier-1",
          provider: "cj",
          externalOrderId: "ext-1",
          status: "AWAITING_PAYMENT",
        },
      })
    );

    const result = await orchestrateCancellation({
      tenantContext,
      cancellationRequestId: "cancel-1",
      correlationId: "corr-1",
    });

    expect(mocks.createQueuedJob).toHaveBeenCalledWith(
      expect.objectContaining({
        jobType: "SUPPLIER_CANCELLATION",
      })
    );
    expect(mocks.escalateRecoveryFailure).not.toHaveBeenCalled();
    expect(result.status).toBe("supplier_cancel_requested");
  });

  it("requires manual review for paid supplier orders", async () => {
    mocks.getRecoveryContext.mockResolvedValue(
      buildRecoveryContext({
        supplierOrder: {
          id: "supplier-1",
          provider: "cj",
          externalOrderId: "ext-1",
          status: "PAID",
        },
      })
    );

    const result = await orchestrateCancellation({
      tenantContext,
      cancellationRequestId: "cancel-1",
    });

    expect(mocks.createQueuedJob).not.toHaveBeenCalled();
    expect(mocks.escalateRecoveryFailure).toHaveBeenCalledWith(
      expect.objectContaining({
        decision: "MANUAL_REVIEW",
      })
    );
    expect(result.status).toBe("review_required");
  });

  it("requires manual review for processing supplier orders", async () => {
    mocks.getRecoveryContext.mockResolvedValue(
      buildRecoveryContext({
        supplierOrder: {
          id: "supplier-1",
          provider: "cj",
          externalOrderId: "ext-1",
          status: "PROCESSING",
        },
      })
    );

    await orchestrateCancellation({
      tenantContext,
      cancellationRequestId: "cancel-1",
    });

    expect(mocks.escalateRecoveryFailure).toHaveBeenCalledWith(
      expect.objectContaining({
        decision: "MANUAL_REVIEW",
      })
    );
  });

  it("marks shipped supplier orders as too late", async () => {
    mocks.getRecoveryContext.mockResolvedValue(
      buildRecoveryContext({
        supplierOrder: {
          id: "supplier-1",
          provider: "cj",
          externalOrderId: "ext-1",
          status: "SHIPPED",
          trackingNumber: "TRACK123",
        },
      })
    );

    await orchestrateCancellation({
      tenantContext,
      cancellationRequestId: "cancel-1",
    });

    expect(mocks.escalateRecoveryFailure).toHaveBeenCalledWith(
      expect.objectContaining({
        decision: "TOO_LATE",
      })
    );
  });

  it("marks delivered supplier orders as too late", async () => {
    mocks.getRecoveryContext.mockResolvedValue(
      buildRecoveryContext({
        supplierOrder: {
          id: "supplier-1",
          provider: "cj",
          externalOrderId: "ext-1",
          status: "DELIVERED",
          trackingNumber: "TRACK123",
        },
      })
    );

    await orchestrateCancellation({
      tenantContext,
      cancellationRequestId: "cancel-1",
    });

    expect(mocks.escalateRecoveryFailure).toHaveBeenCalledWith(
      expect.objectContaining({
        decision: "TOO_LATE",
      })
    );
  });

  it("blocks automatic recovery when a platform fulfilment already exists", async () => {
    mocks.getRecoveryContext.mockResolvedValue(
      buildRecoveryContext({
        platformFulfilment: {
          id: "pf-1",
          platform: "shopify",
          externalFulfilmentId: "gid://shopify/Fulfillment/1",
          status: "fulfilled",
        },
      })
    );

    await orchestrateCancellation({
      tenantContext,
      cancellationRequestId: "cancel-1",
    });

    expect(mocks.escalateRecoveryFailure).toHaveBeenCalledWith(
      expect.objectContaining({
        decision: "CANCEL_PLATFORM_FULFILMENT",
      })
    );
  });
});
