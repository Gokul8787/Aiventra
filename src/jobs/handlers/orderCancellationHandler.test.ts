import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { mocks } = vi.hoisted(() => ({
  mocks: {
    startRecoveryAttempt: vi.fn(),
    completeRecoveryAttempt: vi.fn(),
    updateCancellationRequest: vi.fn(),
    orchestrateCancellation: vi.fn(),
  },
}));

vi.mock("@/services/repositories/recoveryRepository", () => ({
  startRecoveryAttempt: mocks.startRecoveryAttempt,
  completeRecoveryAttempt: mocks.completeRecoveryAttempt,
}));
vi.mock("@/services/repositories/cancellationRepository", () => ({
  updateCancellationRequest: mocks.updateCancellationRequest,
}));
vi.mock("@/services/recovery/orchestrateCancellation", () => ({
  orchestrateCancellation: mocks.orchestrateCancellation,
}));

import { orderCancellationHandler } from "./orderCancellationHandler";

describe("orderCancellationHandler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.startRecoveryAttempt.mockResolvedValue("attempt-1");
    mocks.orchestrateCancellation.mockResolvedValue({
      status: "completed",
      decision: "CANCEL_QUEUED_WORK",
    });
  });

  it("records one recovery attempt and completes orchestration", async () => {
    const reportProgress = vi.fn().mockResolvedValue(undefined);

    const result = await orderCancellationHandler.handle({
      message: {
        jobId: "job-1",
        jobType: "ORDER_CANCELLATION",
        organisationId: "org-1",
        storeId: "store-1",
        payload: {
          cancellationRequestId: "cancel-1",
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

    expect(mocks.startRecoveryAttempt).toHaveBeenCalledTimes(1);
    expect(mocks.orchestrateCancellation).toHaveBeenCalledTimes(1);
    expect(mocks.completeRecoveryAttempt).toHaveBeenCalledWith("attempt-1");
    expect(result.resultReference).toEqual(
      expect.objectContaining({
        cancellationRequestId: "cancel-1",
        recoveryAttemptId: "attempt-1",
      })
    );
  });
});
