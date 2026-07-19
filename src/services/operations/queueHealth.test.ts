import { describe, expect, it } from "vitest";

import { buildQueueHealth } from "./queueHealth";

describe("buildQueueHealth", () => {
  it("builds per-queue counts and activity metrics", () => {
    const now = Date.now();
    const snapshot = buildQueueHealth([
      {
        queueName: "aiventra-jobs",
        status: "queued",
        createdAt: new Date(now - 5 * 60 * 1000).toISOString(),
      },
      {
        queueName: "aiventra-jobs",
        status: "completed",
        createdAt: new Date(now - 20 * 60 * 1000).toISOString(),
        startedAt: new Date(now - 19 * 60 * 1000).toISOString(),
        completedAt: new Date(now - 18 * 60 * 1000).toISOString(),
      },
      {
        queueName: "aiventra-cj",
        status: "dead_letter",
        createdAt: new Date(now - 10 * 60 * 1000).toISOString(),
      },
    ]);

    expect(snapshot.jobs.counts.queued).toBe(1);
    expect(snapshot.jobs.counts.completed).toBe(1);
    expect(snapshot.jobs.active).toBe(1);
    expect(snapshot.jobs.messagesPerHour).toBe(2);
    expect(snapshot.jobs.averageProcessingTimeMs).toBe(60_000);
    expect(snapshot.cj.counts.dead_letter).toBe(1);
  });
});
