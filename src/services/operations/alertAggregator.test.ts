import { describe, expect, it } from "vitest";

import {
  buildAlertsSummary,
  buildDeadLetterSummary,
  buildRecoverySummary,
} from "./alertAggregator";

describe("alertAggregator", () => {
  it("summarises alerts, dead letters, and recovery states", () => {
    const alerts = buildAlertsSummary([
      {
        id: "a1",
        severity: "warning",
        category: "queues",
        title: "Queue slow",
        message: "Oldest message age exceeded target.",
        status: "open",
        createdAt: "2026-07-19T10:00:00.000Z",
        metadata: {},
      },
    ]);
    const deadLetters = buildDeadLetterSummary([
      {
        id: "d1",
        sourceQueue: "aiventra-cj",
        jobType: "supplier_tracking_sync",
        status: "open",
        attemptCount: 5,
        maxAttempts: 5,
        createdAt: "2026-07-19T10:00:00.000Z",
        payload: {},
      },
    ]);
    const recovery = buildRecoverySummary([
      {
        id: "r1",
        orderId: "o1",
        status: "review_required",
        decision: "TOO_LATE",
        requestedAt: "2026-07-19T10:00:00.000Z",
      },
    ]);

    expect(alerts.summary.warning).toBe(1);
    expect(deadLetters.open).toBe(1);
    expect(recovery.manualReview).toBe(1);
    expect(recovery.tooLate).toBe(1);
  });
});
