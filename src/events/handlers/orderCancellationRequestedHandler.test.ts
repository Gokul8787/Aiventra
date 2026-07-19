import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { mocks } = vi.hoisted(() => ({
  mocks: {
    createQueuedJob: vi.fn(),
    enqueueJobMessage: vi.fn(),
    saveQueueMessageId: vi.fn(),
  },
}));

vi.mock("@/services/repositories/backgroundJobRepository", () => ({
  createQueuedJob: mocks.createQueuedJob,
  saveQueueMessageId: mocks.saveQueueMessageId,
}));
vi.mock("@/services/queues/jobQueue", () => ({
  enqueueJobMessage: mocks.enqueueJobMessage,
}));

import { orderCancellationRequestedHandler } from "./orderCancellationRequestedHandler";

describe("orderCancellationRequestedHandler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("does not enqueue a duplicate recovery job when one already exists", async () => {
    mocks.createQueuedJob.mockResolvedValue({
      id: "job-1",
      queueMessageId: 99,
      status: "queued",
    });

    await orderCancellationRequestedHandler.handle({
      id: "event-1",
      tenantContext: {
        organisationId: "org-1",
        storeId: "store-1",
        timezone: "Europe/London",
        currency: "GBP",
        locale: "en-GB",
      },
      eventType: "OrderCancellationRequested",
      aggregateType: "order",
      aggregateId: "order-1",
      payload: {
        orderId: "order-1",
        cancellationRequestId: "cancel-1",
      },
      metadata: {},
      attempts: 1,
      maxAttempts: 5,
      createdAt: "2026-07-19T10:00:00.000Z",
    });

    expect(mocks.enqueueJobMessage).not.toHaveBeenCalled();
    expect(mocks.saveQueueMessageId).not.toHaveBeenCalled();
  });
});
