import { describe, expect, it } from "vitest";

import { buildWorkerHealth } from "./workerHealth";

describe("buildWorkerHealth", () => {
  it("deduplicates workers by latest heartbeat and derives statuses", () => {
    const now = Date.now();
    const result = buildWorkerHealth([
      {
        workerKey: "global:jobs:worker-1",
        workerId: "worker-1",
        queueName: "aiventra-jobs",
        version: "1.0.0",
        heartbeatAt: new Date(now - 30 * 1000).toISOString(),
      },
      {
        workerKey: "global:jobs:worker-2",
        workerId: "worker-2",
        queueName: "aiventra-jobs",
        version: "1.0.0",
        heartbeatAt: new Date(now - 7 * 60 * 1000).toISOString(),
      },
    ]);

    expect(result.summary.healthy).toBe(1);
    expect(result.summary.offline).toBe(1);
    expect(result.recent).toHaveLength(2);
  });
});
