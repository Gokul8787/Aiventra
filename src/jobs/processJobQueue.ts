import "server-only";

import { randomUUID } from "crypto";

import { getJobHandler } from "@/jobs/handlerRegistry";
import { registerJobHandlers } from "@/jobs/registerHandlers";
import {
  classifyJobError,
  getRetryDelaySeconds,
} from "@/jobs/retryPolicy";
import { classifyRecoveryFailure } from "@/recovery/retryPolicy";
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
import { updateCancellationRequest } from "@/services/repositories/cancellationRepository";
import { createOperationsAlert } from "@/services/repositories/operationsAlertRepository";
import {
  createDeadLetterItem,
  failRecoveryAttempt,
  getRecoveryAttemptId,
} from "@/services/repositories/recoveryRepository";

const RECOVERY_JOB_TYPES = new Set([
  "ORDER_CANCELLATION",
  "SUPPLIER_CANCELLATION",
  "RECOVERY_RETRY",
  "DEAD_LETTER_REPLAY",
] as const);

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
  delaySeconds?: number;
}) {
  const nextAttempt = input.message.attempt + 1;
  const delaySeconds =
    input.delaySeconds === undefined
      ? getRetryDelaySeconds(nextAttempt)
      : input.delaySeconds;
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
  queueName: JobQueueName;
  maxAttempts: number;
  errorMessage: string;
}) {
  if (isRecoveryJob(input.message.jobType)) {
    const cancellationRequestId = getCancellationRequestId(input.message);
    const deadLetterId = await createDeadLetterItem({
      organisationId: input.message.organisationId,
      storeId: input.message.storeId,
      sourceQueue: input.queueName,
      jobId: input.message.jobId,
      cancellationRequestId,
      jobType: input.message.jobType.toLowerCase(),
      payload: input.message.payload,
      errorMessage: input.errorMessage,
      attemptCount: input.message.attempt,
      maxAttempts: input.maxAttempts,
      idempotencyKey: `dead-letter:${input.message.jobId}:${input.message.attempt}`,
    });

    await createOperationsAlert({
      organisationId: input.message.organisationId,
      storeId: input.message.storeId,
      severity: "critical",
      category: "recovery",
      title: "Recovery job moved to dead letter",
      message: input.errorMessage,
      resourceType: "ai_job",
      resourceId: input.message.jobId,
      dedupeKey: `recovery-dead-letter:${input.message.jobId}`,
      metadata: {
        deadLetterItemId: deadLetterId,
        jobType: input.message.jobType,
        queueName: input.queueName,
        attempt: input.message.attempt,
      },
    });
  }

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

function isRecoveryJob(jobType: string) {
  return RECOVERY_JOB_TYPES.has(jobType as (typeof RECOVERY_JOB_TYPES extends Set<infer T> ? T : never));
}

function getCancellationRequestId(message: JobMessage): string | undefined {
  const value = message.payload.cancellationRequestId;

  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function getRecoveryAction(jobType: string) {
  switch (jobType) {
    case "ORDER_CANCELLATION":
      return "ORDER_CANCELLATION";
    case "SUPPLIER_CANCELLATION":
      return "SUPPLIER_CANCELLATION";
    case "RECOVERY_RETRY":
      return "RECOVERY_RETRY";
    case "DEAD_LETTER_REPLAY":
      return "DEAD_LETTER_REPLAY";
    default:
      return jobType;
  }
}

async function syncRecoveryAttemptFailure(input: {
  message: JobMessage;
  status: "retrying" | "dead_letter" | "failed";
  retryable: boolean;
  errorMessage: string;
}) {
  const cancellationRequestId = getCancellationRequestId(input.message);

  if (!cancellationRequestId) return;

  const recoveryAttemptId = await getRecoveryAttemptId({
    cancellationRequestId,
    attemptNumber: input.message.attempt,
    action: getRecoveryAction(input.message.jobType),
  });

  if (!recoveryAttemptId) return;

  await failRecoveryAttempt({
    recoveryAttemptId,
    status: input.status,
    retryable: input.retryable,
    errorMessage: input.errorMessage,
  });
}

async function syncRecoveryRequestFailure(input: {
  message: JobMessage;
  maxAttempts: number;
  errorMessage: string;
  nextRetryAt?: string;
  final: boolean;
}) {
  const cancellationRequestId = getCancellationRequestId(input.message);

  if (!cancellationRequestId) return;

  await updateCancellationRequest({
    cancellationRequestId,
    status: input.final ? "failed" : "checking",
    attemptCount: input.message.attempt,
    maxAttempts: input.maxAttempts,
    nextRetryAt:
      input.nextRetryAt === undefined
        ? input.final
          ? null
          : undefined
        : input.nextRetryAt,
    lastError: input.errorMessage,
    processingCompletedAt: input.final ? new Date().toISOString() : undefined,
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
      const maxAttempts = existingJob?.maxAttempts || 5;
      const recoveryDecision = isRecoveryJob(message.jobType)
        ? classifyRecoveryFailure(error, message.attempt, maxAttempts)
        : null;
      const classification = recoveryDecision
        ? recoveryDecision.retry
          ? "retryable"
          : "permanent"
        : classifyJobError(error);
      const retryable = recoveryDecision
        ? recoveryDecision.retry
        : classification === "retryable";
      const shouldDeadLetter = recoveryDecision
        ? recoveryDecision.moveToDeadLetter
        : !retryable || message.attempt >= maxAttempts;

      if (shouldDeadLetter) {
        await syncRecoveryAttemptFailure({
          message,
          status: "dead_letter",
          retryable: false,
          errorMessage,
        });
        await syncRecoveryRequestFailure({
          message,
          maxAttempts,
          errorMessage,
          final: true,
        });
        await deadLetterMessage({
          message,
          tenantContext,
          queueName,
          maxAttempts,
          errorMessage,
        });
      } else {
        const delaySeconds = recoveryDecision?.delaySeconds;
        const nextRetryAt = new Date(
          Date.now() + (delaySeconds ?? getRetryDelaySeconds(message.attempt + 1)) * 1000
        ).toISOString();
        await syncRecoveryAttemptFailure({
          message,
          status: "retrying",
          retryable: true,
          errorMessage,
        });
        await syncRecoveryRequestFailure({
          message,
          maxAttempts,
          errorMessage,
          nextRetryAt,
          final: false,
        });
        await retryMessage({
          message,
          tenantContext,
          queueName,
          errorMessage,
          retryable,
          delaySeconds,
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
