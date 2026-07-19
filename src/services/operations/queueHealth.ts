import type { JobStatus } from "@/jobs/status";
import type { JobQueueName } from "@/jobs/types";
import type {
  OperationsQueueKey,
  OperationsQueueSnapshot,
} from "@/operations/types";

type QueueJobMetricRow = {
  queueName?: string;
  status: JobStatus;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  heartbeatAt?: string;
};

const QUEUE_CONFIG: Record<
  OperationsQueueKey,
  { label: string; queueName: JobQueueName }
> = {
  jobs: {
    label: "Background Jobs",
    queueName: "aiventra-jobs",
  },
  cj: {
    label: "CJ",
    queueName: "aiventra-cj",
  },
  shopify: {
    label: "Shopify",
    queueName: "aiventra-shopify",
  },
  deadLetter: {
    label: "Dead Letter",
    queueName: "aiventra-dead-letter",
  },
};

function ageSeconds(timestamp?: string) {
  if (!timestamp) return 0;
  return Math.max(
    0,
    Math.round((Date.now() - new Date(timestamp).getTime()) / 1000)
  );
}

function defaultCounts(): Record<JobStatus, number> {
  return {
    queued: 0,
    running: 0,
    retrying: 0,
    completed: 0,
    failed: 0,
    cancelled: 0,
    dead_letter: 0,
  };
}

export function buildQueueHealth(
  jobs: QueueJobMetricRow[],
  generatedAt = new Date().toISOString()
): Record<OperationsQueueKey, OperationsQueueSnapshot> {
  const oneHourAgo = Date.now() - 60 * 60 * 1000;
  const staleBefore = Date.now() - 10 * 60 * 1000;

  return Object.entries(QUEUE_CONFIG).reduce(
    (result, [key, config]) => {
      const queueJobs = jobs.filter((job) => job.queueName === config.queueName);
      const counts = defaultCounts();
      const activeJobs = queueJobs.filter((job) =>
        ["queued", "running", "retrying"].includes(job.status)
      );
      let processingSampleCount = 0;
      let processingTotalMs = 0;
      let messagesPerHour = 0;
      let failuresPerHour = 0;
      let staleJobs = 0;

      for (const job of queueJobs) {
        counts[job.status] += 1;

        if (new Date(job.createdAt).getTime() >= oneHourAgo) {
          messagesPerHour += 1;
        }

        if (
          ["failed", "dead_letter", "cancelled"].includes(job.status) &&
          new Date(job.createdAt).getTime() >= oneHourAgo
        ) {
          failuresPerHour += 1;
        }

        if (
          job.startedAt &&
          job.completedAt &&
          new Date(job.completedAt).getTime() >= oneHourAgo
        ) {
          processingSampleCount += 1;
          processingTotalMs +=
            new Date(job.completedAt).getTime() -
            new Date(job.startedAt).getTime();
        }

        if (
          job.status === "running" &&
          job.heartbeatAt &&
          new Date(job.heartbeatAt).getTime() < staleBefore
        ) {
          staleJobs += 1;
        }
      }

      const oldestQueued = activeJobs
        .map((job) => ageSeconds(job.createdAt))
        .sort((left, right) => right - left)[0];

      result[key as OperationsQueueKey] = {
        key: key as OperationsQueueKey,
        label: config.label,
        queueName: config.queueName,
        counts,
        active: activeJobs.length,
        oldestMessageAgeSeconds: oldestQueued || 0,
        messagesPerHour,
        failuresPerHour,
        averageProcessingTimeMs:
          processingSampleCount > 0
            ? Math.round(processingTotalMs / processingSampleCount)
            : 0,
        staleJobs,
        updatedAt: generatedAt,
      };

      return result;
    },
    {} as Record<OperationsQueueKey, OperationsQueueSnapshot>
  );
}
