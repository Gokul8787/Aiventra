import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { mocks } = vi.hoisted(() => ({
  mocks: {
    startRecoveryAttempt: vi.fn(),
    completeRecoveryAttempt: vi.fn(),
    getCancellationRequestById: vi.fn(),
    updateCancellationRequest: vi.fn(),
    cancelSupplierOrder: vi.fn(),
    publishEvent: vi.fn(),
  },
}));

vi.mock("@/services/repositories/recoveryRepository", () => ({
  startRecoveryAttempt: mocks.startRecoveryAttempt,
  completeRecoveryAttempt: mocks.completeRecoveryAttempt,
}));
vi.mock("@/services/repositories/cancellationRepository", () => ({
  getCancellationRequestById: mocks.getCancellationRequestById,
  updateCancellationRequest: mocks.updateCancellationRequest,
}));
vi.mock("@/services/recovery/cancelSupplierOrder", () => ({
  cancelSupplierOrder: mocks.cancelSupplierOrder,
}));
vi.mock("@/services/events/eventRepository", () => ({
  publishEvent: mocks.publishEvent,
}));

import { supplierCancellationHandler } from "./supplierCancellationHandler";

describe("supplierCancellationHandler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.startRecoveryAttempt.mockResolvedValue("attempt-1");
    mocks.getCancellationRequestById.mockResolvedValue({
      id: "cancel-1",
      order_id: "order-1",
    });
  });

  it("completes supplier cancellation successfully", async () => {
    const reportProgress = vi.fn().mockResolvedValue(undefined);
    mocks.cancelSupplierOrder.mockResolvedValue({
      success: true,
      duplicate: false,
      status: "CANCELLED",
    });

    const result = await supplierCancellationHandler.handle({
      message: {
        jobId: "job-1",
        jobType: "SUPPLIER_CANCELLATION",
        organisationId: "org-1",
        storeId: "store-1",
        payload: {
          cancellationRequestId: "cancel-1",
          supplierOrderId: "supplier-1",
          tenantContext: {
            timezone: "Europe/London",
            currency: "GBP",
            locale: "en-GB",
          },
        },
        correlationId: "corr-1",
        causationId: "cause-1",
        attempt: 1,
        createdAt: "2026-07-19T08:00:00.000Z",
      },
      workerId: "worker-1",
      reportProgress,
    });

    expect(mocks.cancelSupplierOrder).toHaveBeenCalledTimes(1);
    expect(mocks.publishEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: "CancellationCompleted",
      })
    );
    expect(mocks.updateCancellationRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "completed",
      })
    );
    expect(result.resultReference?.status).toBe("CANCELLED");
  });

  it("handles re-delivered queue messages idempotently", async () => {
    mocks.cancelSupplierOrder.mockResolvedValue({
      success: true,
      duplicate: true,
      status: "CANCELLED",
    });

    const result = await supplierCancellationHandler.handle({
      message: {
        jobId: "job-1",
        jobType: "SUPPLIER_CANCELLATION",
        organisationId: "org-1",
        storeId: "store-1",
        payload: {
          cancellationRequestId: "cancel-1",
          supplierOrderId: "supplier-1",
          tenantContext: {
            timezone: "Europe/London",
            currency: "GBP",
            locale: "en-GB",
          },
        },
        correlationId: "corr-1",
        causationId: "cause-1",
        attempt: 2,
        createdAt: "2026-07-19T08:05:00.000Z",
      },
      workerId: "worker-1",
      reportProgress: vi.fn().mockResolvedValue(undefined),
    });

    expect(mocks.cancelSupplierOrder).toHaveBeenCalledTimes(1);
    expect(result.resultReference?.duplicate).toBe(true);
  });
});
