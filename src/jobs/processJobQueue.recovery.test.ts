import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { mocks } = vi.hoisted(() => ({
  mocks: {
    registerJobHandlers: vi.fn(),
    getJobHandler: vi.fn(),
    readJobMessages: vi.fn(),
    archiveQueueMessage: vi.fn(),
    enqueueJobMessage: vi.fn(),
    moveToDeadLetter: vi.fn(),
    getBackgroundJob: vi.fn(),
    markJobRunning: vi.fn(),
    appendJobLog: vi.fn(),
    updateJobProgress: vi.fn(),
    completeBackgroundJob: vi.fn(),
    failBackgroundJob: vi.fn(),
    markJobRetrying: vi.fn(),
    rescheduleBackgroundJob: vi.fn(),
    createDeadLetterItem: vi.fn(),
    createOperationsAlert: vi.fn(),
    getRecoveryAttemptId: vi.fn(),
    failRecoveryAttempt: vi.fn(),
    updateCancellationRequest: vi.fn(),
  },
}));

vi.mock("@/jobs/registerHandlers", () => ({
  registerJobHandlers: mocks.registerJobHandlers,
}));
vi.mock("@/jobs/handlerRegistry", () => ({
  getJobHandler: mocks.getJobHandler,
}));
vi.mock("@/services/queues/jobQueue", () => ({
  readJobMessages: mocks.readJobMessages,
  archiveQueueMessage: mocks.archiveQueueMessage,
  enqueueJobMessage: mocks.enqueueJobMessage,
  moveToDeadLetter: mocks.moveToDeadLetter,
}));
vi.mock("@/services/repositories/backgroundJobRepository", () => ({
  getBackgroundJob: mocks.getBackgroundJob,
  markJobRunning: mocks.markJobRunning,
  appendJobLog: mocks.appendJobLog,
  updateJobProgress: mocks.updateJobProgress,
  completeBackgroundJob: mocks.completeBackgroundJob,
  failBackgroundJob: mocks.failBackgroundJob,
  markJobRetrying: mocks.markJobRetrying,
  rescheduleBackgroundJob: mocks.rescheduleBackgroundJob,
}));
vi.mock("@/services/repositories/recoveryRepository", () => ({
  createDeadLetterItem: mocks.createDeadLetterItem,
  getRecoveryAttemptId: mocks.getRecoveryAttemptId,
  failRecoveryAttempt: mocks.failRecoveryAttempt,
}));
vi.mock("@/services/repositories/operationsAlertRepository", () => ({
  createOperationsAlert: mocks.createOperationsAlert,
}));
vi.mock("@/services/repositories/cancellationRepository", () => ({
  updateCancellationRequest: mocks.updateCancellationRequest,
}));

import { RecoveryPermanentError, RecoveryRetryableError } from "@/recovery/errors";
import { processJobQueue } from "./processJobQueue";

function recoveryMessage(overrides: Record<string, unknown> = {}) {
  return {
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
    createdAt: "2026-07-19T09:00:00.000Z",
    ...overrides,
  };
}

describe("processJobQueue recovery flows", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getRecoveryAttemptId.mockResolvedValue("attempt-1");
    mocks.getBackgroundJob.mockResolvedValue({
      id: "job-1",
      status: "queued",
      maxAttempts: 5,
    });
  });

  it("skips cancelled jobs before handler execution", async () => {
    mocks.readJobMessages.mockResolvedValue([
      {
        messageId: 1,
        message: recoveryMessage(),
      },
    ]);
    mocks.getBackgroundJob.mockResolvedValue({
      id: "job-1",
      status: "cancelled",
      maxAttempts: 5,
    });

    const result = await processJobQueue({
      queueName: "aiventra-cj",
      limit: 1,
    });

    expect(mocks.getJobHandler).not.toHaveBeenCalled();
    expect(result.results[0]).toEqual(
      expect.objectContaining({
        status: "skipped",
      })
    );
  });

  it("retries temporary CJ failures without dead-lettering", async () => {
    mocks.readJobMessages.mockResolvedValue([
      {
        messageId: 1,
        message: recoveryMessage(),
      },
    ]);
    mocks.getJobHandler.mockReturnValue({
      handle: vi.fn().mockRejectedValue(new RecoveryRetryableError("CJ 429")),
    });

    const result = await processJobQueue({
      queueName: "aiventra-cj",
      limit: 1,
    });

    expect(mocks.markJobRetrying).toHaveBeenCalledTimes(1);
    expect(mocks.enqueueJobMessage).toHaveBeenCalledTimes(1);
    expect(mocks.createDeadLetterItem).not.toHaveBeenCalled();
    expect(result.results[0]?.status).toBe("retrying");
  });

  it("dead-letters permanent recovery failures immediately", async () => {
    mocks.readJobMessages.mockResolvedValue([
      {
        messageId: 1,
        message: recoveryMessage(),
      },
    ]);
    mocks.getJobHandler.mockReturnValue({
      handle: vi
        .fn()
        .mockRejectedValue(
          new RecoveryPermanentError("Invalid supplier order", "INVALID_ORDER")
        ),
    });

    const result = await processJobQueue({
      queueName: "aiventra-cj",
      limit: 1,
    });

    expect(mocks.createDeadLetterItem).toHaveBeenCalledTimes(1);
    expect(mocks.createOperationsAlert).toHaveBeenCalledTimes(1);
    expect(mocks.moveToDeadLetter).toHaveBeenCalledTimes(1);
    expect(result.results[0]?.status).toBe("dead_letter");
  });

  it("dead-letters the fifth temporary failure once", async () => {
    mocks.readJobMessages.mockResolvedValue([
      {
        messageId: 1,
        message: recoveryMessage({
          attempt: 5,
        }),
      },
    ]);
    mocks.getJobHandler.mockReturnValue({
      handle: vi.fn().mockRejectedValue(new RecoveryRetryableError("network timeout")),
    });

    await processJobQueue({
      queueName: "aiventra-cj",
      limit: 1,
    });

    expect(mocks.createDeadLetterItem).toHaveBeenCalledTimes(1);
    expect(mocks.createOperationsAlert).toHaveBeenCalledTimes(1);
    expect(mocks.markJobRetrying).not.toHaveBeenCalled();
  });
});
