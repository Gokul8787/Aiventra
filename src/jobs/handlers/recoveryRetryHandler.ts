import type { TenantContext } from "@/context/storeContext";
import { tenantPayload } from "@/context/storeContext";
import { RecoveryPermanentError } from "@/recovery/errors";
import type { AiventraJobType, JobMessage, JobQueueName } from "@/jobs/types";
import { enqueueJobMessage } from "@/services/queues/jobQueue";
import { appendJobLog, createQueuedJob, saveQueueMessageId } from "@/services/repositories/backgroundJobRepository";
import type { JobHandler } from "./types";

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

export const recoveryRetryHandler: JobHandler = {
  jobType: "RECOVERY_RETRY",

  async handle({ message, reportProgress }) {
    const tenantContext = tenantContextFromMessage(message);
    const targetJobType = String(message.payload.targetJobType || "") as AiventraJobType;
    const targetQueueName = String(
      message.payload.targetQueueName || "aiventra-jobs"
    ) as JobQueueName;
    const targetPayload = (message.payload.targetPayload || {}) as Record<
      string,
      unknown
    >;
    const idempotencyKey = String(message.payload.idempotencyKey || "");

    if (!targetJobType || !idempotencyKey) {
      throw new RecoveryPermanentError(
        "Recovery retry is missing target job information.",
        "RECOVERY_RETRY_INVALID_PAYLOAD"
      );
    }

    await reportProgress(35, "Preparing replay job");

    const job = await createQueuedJob({
      tenantContext,
      jobType: targetJobType,
      queueName: targetQueueName,
      payload: {
        ...targetPayload,
        tenantContext: targetPayload.tenantContext || tenantPayload(tenantContext),
      },
      idempotencyKey,
    });

    if (!job.queueMessageId) {
      const queueMessageId = await enqueueJobMessage({
        queueName: targetQueueName,
        jobId: job.id,
        jobType: targetJobType,
        organisationId: tenantContext.organisationId,
        storeId: tenantContext.storeId,
        payload: {
          ...targetPayload,
          tenantContext:
            targetPayload.tenantContext || tenantPayload(tenantContext),
        },
        correlationId: message.correlationId,
        causationId: message.jobId,
      });

      await saveQueueMessageId(job.id, queueMessageId);

      await appendJobLog({
        tenantContext,
        jobId: job.id,
        level: "info",
        step: "Queued",
        message: "Recovery retry re-enqueued a target job.",
        context: {
          replaySourceJobId: message.jobId,
          targetJobType,
          targetQueueName,
          queueMessageId,
        },
      });
    }

    await reportProgress(100, "Replay job queued");

    return {
      resultReference: {
        targetJobId: job.id,
        targetJobType,
        targetQueueName,
      },
    };
  },
};
