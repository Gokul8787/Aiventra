import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { supabaseAdminMock } = vi.hoisted(() => ({
  supabaseAdminMock: {
    from: vi.fn(),
  },
}));

vi.mock("@/services/supabase/admin", () => ({
  supabaseAdmin: supabaseAdminMock,
}));

import {
  createDeadLetterItem,
  listDeadLetterItemsForCancellationRequests,
  listRecoveryAttemptsForCancellationRequest,
  markDeadLetterItemRequeued,
  saveRecoveryAnalysis,
  startRecoveryAttempt,
  updateDeadLetterItemStatus,
} from "./recoveryRepository";

function createUpdateChain() {
  const eq = vi.fn().mockResolvedValue({ error: null });
  const update = vi.fn(() => ({ eq }));
  return { update, eq };
}

describe("recoveryRepository", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("saves recovery analysis to the cancellation request", async () => {
    const chain = createUpdateChain();
    supabaseAdminMock.from.mockReturnValue(chain);

    await saveRecoveryAnalysis({
      cancellationRequestId: "cancel-1",
      analysis: {
        decision: "MANUAL_REVIEW",
        confidence: 90,
        reasons: [],
        blockers: ["Paid supplier order."],
        warnings: [],
        supplierCancellationRequired: true,
        platformCancellationRequired: false,
        queuedWorkCancellationRequired: true,
        automaticExecutionAllowed: false,
        analysedAt: "2026-07-19T09:00:00.000Z",
        engineVersion: "1.0.0",
      },
    });

    expect(chain.update).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "checking",
        decision: "MANUAL_REVIEW",
      })
    );
  });

  it("creates recovery attempts idempotently", async () => {
    const single = vi.fn().mockResolvedValue({
      data: { id: "attempt-1" },
      error: null,
    });
    const select = vi.fn(() => ({ single }));
    const upsert = vi.fn(() => ({ select }));
    supabaseAdminMock.from.mockReturnValue({ upsert });

    const id = await startRecoveryAttempt({
      organisationId: "org-1",
      storeId: "store-1",
      cancellationRequestId: "cancel-1",
      attemptNumber: 1,
      action: "ORDER_CANCELLATION",
    });

    expect(id).toBe("attempt-1");
    expect(upsert).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({
        onConflict: "cancellation_request_id,attempt_number,action",
      })
    );
  });

  it("creates dead-letter items with idempotent upsert keys", async () => {
    const single = vi.fn().mockResolvedValue({
      data: { id: "dead-letter-1" },
      error: null,
    });
    const select = vi.fn(() => ({ single }));
    const upsert = vi.fn(() => ({ select }));
    supabaseAdminMock.from.mockReturnValue({ upsert });

    const id = await createDeadLetterItem({
      organisationId: "org-1",
      storeId: "store-1",
      sourceQueue: "aiventra-cj",
      jobId: "job-1",
      cancellationRequestId: "cancel-1",
      jobType: "supplier_cancellation",
      payload: {},
      errorMessage: "Network timeout",
      attemptCount: 5,
      maxAttempts: 5,
      idempotencyKey: "dead-letter:job-1:5",
    });

    expect(id).toBe("dead-letter-1");
    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        idempotency_key: "dead-letter:job-1:5",
      }),
      expect.objectContaining({
        onConflict: "idempotency_key",
      })
    );
  });

  it("loads recovery attempts and dead-letter items", async () => {
    supabaseAdminMock.from
      .mockReturnValueOnce({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            order: vi.fn().mockResolvedValue({
              data: [{ id: "attempt-1" }],
              error: null,
            }),
          })),
        })),
      })
      .mockReturnValueOnce({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            eq: vi.fn(() => ({
              in: vi.fn(() => ({
                order: vi.fn().mockResolvedValue({
                  data: [
                    {
                      id: "dead-1",
                      organisation_id: "org-1",
                      store_id: "store-1",
                      source_queue: "aiventra-cj",
                      job_id: "job-1",
                      cancellation_request_id: "cancel-1",
                      job_type: "supplier_cancellation",
                      payload: {},
                      error_code: null,
                      error_message: "Error",
                      attempt_count: 5,
                      max_attempts: 5,
                      status: "open",
                      idempotency_key: "key-1",
                      created_at: "2026-07-19T09:00:00.000Z",
                      requeued_at: null,
                      resolved_at: null,
                    },
                  ],
                  error: null,
                }),
              })),
            })),
          })),
        })),
      });

    const attempts = await listRecoveryAttemptsForCancellationRequest({
      cancellationRequestId: "cancel-1",
    });
    const items = await listDeadLetterItemsForCancellationRequests({
      organisationId: "org-1",
      storeId: "store-1",
      cancellationRequestIds: ["cancel-1"],
    });

    expect(attempts).toHaveLength(1);
    expect(items[0]?.idempotencyKey).toBe("key-1");
  });

  it("marks dead-letter items as requeued", async () => {
    const eq = vi.fn().mockResolvedValue({ error: null });
    const chain = {
      update: vi.fn(() => ({
        eq: vi.fn(() => ({
          eq,
        })),
      })),
    };
    supabaseAdminMock.from.mockReturnValue(chain);

    await markDeadLetterItemRequeued({
      deadLetterItemId: "dead-1",
    });

    expect(chain.update).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "requeued",
      })
    );
  });

  it("updates dead-letter items to resolved or ignored", async () => {
    const eq = vi.fn().mockResolvedValue({ error: null });
    const chain = {
      update: vi.fn(() => ({
        eq,
      })),
    };
    supabaseAdminMock.from.mockReturnValue(chain);

    await updateDeadLetterItemStatus({
      deadLetterItemId: "dead-1",
      status: "resolved",
    });

    expect(chain.update).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "resolved",
      })
    );
  });
});
