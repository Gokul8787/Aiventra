import "server-only";

import type { AiventraJobType } from "@/jobs/types";
import { enqueueJobMessage } from "@/services/queues/jobQueue";
import {
  appendJobLog,
  findStaleRunningJobs,
  markJobRetrying,
  saveQueueMessageId,
} from "@/services/repositories/backgroundJobRepository";
import type { TenantContext } from "@/context/storeContext";
import { queueForJobType } from "./jobQueueRouting";

function tenantContextFromJob(job: {
  organisationId?: string;
  storeId?: string;
  input: Record<string, unknown>;
}): TenantContext {
  const payloadContext = job.input.tenantContext as Partial<TenantContext> | undefined;

  return {
    organisationId: job.organisationId || "",
    storeId: job.storeId || "",
    timezone: payloadContext?.timezone || "Europe/London",
    currency: payloadContext?.currency || "GBP",
    locale: payloadContext?.locale || "en-GB",
    userId: payloadContext?.userId,
    country: payloadContext?.country,
    organisationName: payloadContext?.organisationName,
    storeName: payloadContext?.storeName,
  };
}

export async function recoverStaleJobs(input?: {
  olderThanMinutes?: number;
  limit?: number;
}): Promise<{
  recovered: number;
  jobs: Array<{ jobId: string; queueMessageId: number }>;
}> {
  const staleJobs = await findStaleRunningJobs({
    olderThanMinutes: input?.olderThanMinutes || 10,
    limit: input?.limit || 25,
  });
  const recovered = [];

  for (const job of staleJobs) {
    if (!job.organisationId || !job.storeId || !job.jobType) continue;
    if (
      job.status === "completed" ||
      job.status === "cancelled" ||
      job.status === "dead_letter"
    ) {
      continue;
    }

    const jobType = job.jobType as AiventraJobType;
    const queueName = queueForJobType(jobType);
    const nextAttempt = Math.min(job.attemptCount + 1, job.maxAttempts);
    const tenantContext = tenantContextFromJob(job);

    await markJobRetrying({
      jobId: job.id,
      attempt: job.attemptCount || 1,
      errorMessage: "Recovering stale job after missing heartbeat.",
      nextRetryAt: new Date().toISOString(),
      retryable: true,
    });

    const queueMessageId = await enqueueJobMessage({
      queueName,
      jobId: job.id,
      jobType,
      organisationId: job.organisationId,
      storeId: job.storeId,
      payload: job.input || {},
      correlationId: job.correlationId,
      causationId: job.causationId,
      attempt: nextAttempt,
    });

    await saveQueueMessageId(job.id, queueMessageId);

    await appendJobLog({
      tenantContext,
      jobId: job.id,
      level: "warning",
      step: "Stale recovery",
      message: "Stale running job recovered and requeued.",
      context: {
        queueMessageId,
        nextAttempt,
      },
    });

    recovered.push({
      jobId: job.id,
      queueMessageId,
    });
  }

  return {
    recovered: recovered.length,
    jobs: recovered,
  };
}
