import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { mocks } = vi.hoisted(() => ({
  mocks: {
    getDeadLetterItemById: vi.fn(),
    markDeadLetterItemRequeued: vi.fn(),
    createQueuedJob: vi.fn(),
    enqueueJobMessage: vi.fn(),
    saveQueueMessageId: vi.fn(),
    appendJobLog: vi.fn(),
  },
}));

vi.mock("@/services/repositories/recoveryRepository", () => ({
  getDeadLetterItemById: mocks.getDeadLetterItemById,
  markDeadLetterItemRequeued: mocks.markDeadLetterItemRequeued,
}));
vi.mock("@/services/repositories/backgroundJobRepository", () => ({
  createQueuedJob: mocks.createQueuedJob,
  saveQueueMessageId: mocks.saveQueueMessageId,
  appendJobLog: mocks.appendJobLog,
}));
vi.mock("@/services/queues/jobQueue", () => ({
  enqueueJobMessage: mocks.enqueueJobMessage,
}));

import { deadLetterReplayHandler } from "./deadLetterReplayHandler";

describe("deadLetterReplayHandler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates one new queued job and marks the item requeued", async () => {
    mocks.getDeadLetterItemById.mockResolvedValue({
      id: "dead-1",
      jobId: "old-job-1",
      sourceQueue: "aiventra-cj",
      jobType: "supplier_cancellation",
      payload: {
        cancellationRequestId: "cancel-1",
        supplierOrderId: "supplier-1",
      },
      status: "open",
    });
    mocks.createQueuedJob.mockResolvedValue({
      id: "new-job-1",
      queueMessageId: 44,
      status: "queued",
    });

    const result = await deadLetterReplayHandler.handle({
      message: {
        jobId: "replay-job-1",
        jobType: "DEAD_LETTER_REPLAY",
        organisationId: "org-1",
        storeId: "store-1",
        payload: {
          deadLetterItemId: "dead-1",
          tenantContext: {
            timezone: "Europe/London",
            currency: "GBP",
            locale: "en-GB",
          },
        },
        correlationId: "corr-1",
        causationId: "cause-1",
        attempt: 1,
        createdAt: "2026-07-19T10:30:00.000Z",
      },
      workerId: "worker-1",
      reportProgress: vi.fn().mockResolvedValue(undefined),
    });

    expect(mocks.createQueuedJob).toHaveBeenCalledTimes(1);
    expect(mocks.markDeadLetterItemRequeued).toHaveBeenCalledWith({
      deadLetterItemId: "dead-1",
      organisationId: "org-1",
      storeId: "store-1",
    });
    expect(result.resultReference?.targetJobId).toBe("new-job-1");
  });
});
