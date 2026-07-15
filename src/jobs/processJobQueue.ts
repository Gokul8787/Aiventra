import "server-only";

import { randomUUID } from "crypto";

import { getJobHandler } from "@/jobs/handlerRegistry";
import { registerJobHandlers } from "@/jobs/registerHandlers";
import {
  classifyJobError,
  getRetryDelaySeconds,
} from "@/jobs/retryPolicy";
import type { JobMessage, JobQueueName } from "@/jobs/types";
import type { TenantContext } from "@/context/storeContext";
import {
  archiveQueueMessage,
  enqueueJobMessage,
  moveToDeadLetter,
  readJobMessages,
} from "@/services/queues/jobQueue";
import {
  appendJobLog,
  completeBackgroundJob,
  failBackgroundJob,
  getBackgroundJob,
  markJobRunning,
  markJobRetrying,
  rescheduleBackgroundJob,
  updateJobProgress,
} from "@/services/repositories/backgroundJobRepository";

function tenantContextFromMessage(message: JobMessage): TenantContext {
  const payloadContext = message.payload.tenantContext as
    | Partial<TenantContext>
    | undefined;

  return {
    organisationId: message.organisationId,
    storeId: message.storeId,
    timezone: payloadContext?.timezone || "Europe/London",
    currency: payloadContext?.currency || "GBP",
    locale: payloadContext?.locale || "en-GB",
    userId: payloadContext?.userId,
    country: payloadContext?.country,
    organisationName: payloadContext?.organisationName,
    storeName: payloadContext?.storeName,
  };
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Unknown job error.";
}

async function safelyArchiveMessage(
  queueName: JobQueueName,
  messageId: number
) {
  try {
    await archiveQueueMessage({ queueName, messageId });
  } catch (error) {
    console.error("Failed to archive queue message:", error);
  }
}

async function retryMessage(input: {
  message: JobMessage;
  tenantContext: TenantContext;
  queueName: JobQueueName;
  errorMessage: string;
  retryable: boolean;
}) {
  const nextAttempt = input.message.attempt + 1;
  const delaySeconds = getRetryDelaySeconds(nextAttempt);
  const nextRetryAt = new Date(Date.now() + delaySeconds * 1000).toISOString();

  await markJobRetrying({
    jobId: input.message.jobId,
    attempt: input.message.attempt,
    errorMessage: input.errorMessage,
    nextRetryAt,
    retryable: input.retryable,
  });

  await appendJobLog({
    tenantContext: input.tenantContext,
    jobId: input.message.jobId,
    level: "warning",
    step: "Retrying",
    message: `Job failed. Retrying attempt ${nextAttempt}.`,
    context: {
      errorMessage: input.errorMessage,
      nextAttempt,
      delaySeconds,
    },
  });

  await enqueueJobMessage({
    queueName: input.queueName,
    jobId: input.message.jobId,
    jobType: input.message.jobType,
    organisationId: input.message.organisationId,
    storeId: input.message.storeId,
    payload: input.message.payload,
    correlationId: input.message.correlationId,
    causationId: input.message.causationId,
    attempt: nextAttempt,
    delaySeconds,
  });
}

async function deadLetterMessage(input: {
  message: JobMessage;
  tenantContext: TenantContext;
  errorMessage: string;
}) {
  await moveToDeadLetter(input.message, input.errorMessage);

  await failBackgroundJob({
    jobId: input.message.jobId,
    attempt: input.message.attempt,
    errorMessage: input.errorMessage,
    deadLetter: true,
  });

  await appendJobLog({
    tenantContext: input.tenantContext,
    jobId: input.message.jobId,
    level: "error",
    step: "Dead letter",
    message: "Job moved to the dead-letter queue.",
    context: {
      errorMessage: input.errorMessage,
      attempt: input.message.attempt,
    },
  });
}

export async function processJobQueue(input?: {
  queueName?: JobQueueName;
  limit?: number;
  workerId?: string;
  visibilityTimeoutSeconds?: number;
}) {
  registerJobHandlers();

  const queueName = input?.queueName || "aiventra-jobs";
  const workerId = input?.workerId || `aiventra-worker-${randomUUID()}`;
  const queuedMessages = await readJobMessages({
    queueName,
    limit: input?.limit ?? (queueName === "aiventra-cj" ? 1 : 3),
    visibilityTimeoutSeconds: input?.visibilityTimeoutSeconds ?? 300,
  });

  const results = [];

  for (const queuedMessage of queuedMessages) {
    const { message, messageId } = queuedMessage;
    const tenantContext = tenantContextFromMessage(message);

    try {
      const existingJob = await getBackgroundJob(tenantContext, message.jobId);

      if (
        existingJob?.status === "completed" ||
        existingJob?.status === "dead_letter" ||
        existingJob?.status === "cancelled"
      ) {
        await safelyArchiveMessage(queueName, messageId);

        results.push({
          jobId: message.jobId,
          jobType: message.jobType,
          status: "skipped",
          reason: `Job is already ${existingJob.status}.`,
        });

        continue;
      }

      const handler = getJobHandler(message.jobType);

      if (!handler) {
        throw new Error(`No job handler registered for ${message.jobType}.`);
      }

      await markJobRunning({
        tenantContext,
        jobId: message.jobId,
        workerId,
        attempt: message.attempt,
        currentStep: "Starting",
      });

      await appendJobLog({
        tenantContext,
        jobId: message.jobId,
        level: "info",
        step: "Starting",
        message: "Worker claimed job.",
        context: {
          workerId,
          messageId,
          queueName,
          attempt: message.attempt,
          jobType: message.jobType,
        },
      });

      const handlerResult = await handler.handle({
        message,
        workerId,
        reportProgress: async (progress, step, progressMessage) => {
          await updateJobProgress({
            tenantContext,
            jobId: message.jobId,
            workerId,
            progress,
            currentStep: step,
            message: progressMessage,
          });
        },
      });

      if (handlerResult.nextJobs?.length) {
        for (const nextJob of handlerResult.nextJobs) {
          await enqueueJobMessage({
            queueName: nextJob.queueName,
            jobId: message.jobId,
            jobType: nextJob.jobType,
            organisationId: message.organisationId,
            storeId: message.storeId,
            payload: nextJob.payload,
            correlationId: message.correlationId,
            causationId: message.jobId,
          });
        }
      }

      if (handlerResult.rescheduled) {
        await rescheduleBackgroundJob({
          jobId: message.jobId,
          nextRetryAt:
            typeof handlerResult.resultReference?.permittedAt === "string"
              ? handlerResult.resultReference.permittedAt
              : undefined,
          reason: "Waiting for provider permit",
        });

        await appendJobLog({
          tenantContext,
          jobId: message.jobId,
          level: "info",
          step: "Rescheduled",
          message: "Job message rescheduled for a later worker pass.",
          context: handlerResult.resultReference || {},
        });

        await safelyArchiveMessage(queueName, messageId);

        results.push({
          jobId: message.jobId,
          jobType: message.jobType,
          status: "rescheduled",
          resultReference: handlerResult.resultReference || {},
        });

        continue;
      }

      await completeBackgroundJob({
        jobId: message.jobId,
        attempt: message.attempt,
        resultReference: handlerResult.resultReference,
      });

      await appendJobLog({
        tenantContext,
        jobId: message.jobId,
        level: "info",
        step: "Completed",
        message: "Job completed.",
        context: handlerResult.resultReference || {},
      });

      await safelyArchiveMessage(queueName, messageId);

      results.push({
        jobId: message.jobId,
        jobType: message.jobType,
        status: "completed",
        resultReference: handlerResult.resultReference || {},
      });
    } catch (error) {
      const errorMessage = getErrorMessage(error);
      const existingJob = await getBackgroundJob(tenantContext, message.jobId);
      const classification = classifyJobError(error);
      const retryable = classification === "retryable";
      const maxAttempts = existingJob?.maxAttempts || 5;
      const shouldDeadLetter = !retryable || message.attempt >= maxAttempts;

      if (shouldDeadLetter) {
        await deadLetterMessage({
          message,
          tenantContext,
          errorMessage,
        });
      } else {
        await retryMessage({
          message,
          tenantContext,
          queueName,
          errorMessage,
          retryable,
        });
      }

      await safelyArchiveMessage(queueName, messageId);

      results.push({
        jobId: message.jobId,
        jobType: message.jobType,
        status: shouldDeadLetter ? "dead_letter" : "retrying",
        message: errorMessage,
      });
    }
  }

  return {
    workerId,
    queueName,
    processed: results.length,
    results,
  };
}
