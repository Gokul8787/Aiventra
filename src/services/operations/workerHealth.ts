import type { WorkerSnapshot, WorkerStatus } from "@/operations/types";

type WorkerHeartbeatRow = {
  workerKey: string;
  workerId: string;
  queueName: string;
  version: string;
  host?: string;
  status?: string;
  memoryMb?: number;
  cpuPercent?: number;
  heartbeatAt: string;
  metadata?: Record<string, unknown>;
};

function deriveWorkerStatus(heartbeatAt: string): WorkerStatus {
  const ageMs = Date.now() - new Date(heartbeatAt).getTime();

  if (ageMs <= 2 * 60 * 1000) return "healthy";
  if (ageMs <= 5 * 60 * 1000) return "warning";
  return "offline";
}

export function buildWorkerHealth(rows: WorkerHeartbeatRow[]): {
  summary: Record<WorkerStatus, number>;
  recent: WorkerSnapshot[];
} {
  const deduped = new Map<string, WorkerHeartbeatRow>();

  for (const row of rows) {
    const existing = deduped.get(row.workerKey);

    if (
      !existing ||
      new Date(row.heartbeatAt).getTime() >
        new Date(existing.heartbeatAt).getTime()
    ) {
      deduped.set(row.workerKey, row);
    }
  }

  const recent = Array.from(deduped.values())
    .map((row) => ({
      workerKey: row.workerKey,
      workerId: row.workerId,
      queueName: row.queueName,
      version: row.version,
      host: row.host,
      status: deriveWorkerStatus(row.heartbeatAt),
      memoryMb: row.memoryMb,
      cpuPercent: row.cpuPercent,
      heartbeatAt: row.heartbeatAt,
      metadata: row.metadata || {},
    }))
    .sort(
      (left, right) =>
        new Date(right.heartbeatAt).getTime() -
        new Date(left.heartbeatAt).getTime()
    );

  const summary = {
    healthy: 0,
    warning: 0,
    offline: 0,
  } satisfies Record<WorkerStatus, number>;

  for (const worker of recent) {
    summary[worker.status] += 1;
  }

  return {
    summary,
    recent,
  };
}
