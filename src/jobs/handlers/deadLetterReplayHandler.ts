import type { TenantContext } from "@/context/storeContext";
import { tenantPayload } from "@/context/storeContext";
import { RecoveryPermanentError } from "@/recovery/errors";
import type { AiventraJobType, JobMessage, JobQueueName } from "@/jobs/types";
import { enqueueJobMessage } from "@/services/queues/jobQueue";
import { appendJobLog, createQueuedJob, saveQueueMessageId } from "@/services/repositories/backgroundJobRepository";
import {
  getDeadLetterItemById,
  markDeadLetterItemRequeued,
} from "@/services/repositories/recoveryRepository";
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

export const deadLetterReplayHandler: JobHandler = {
  jobType: "DEAD_LETTER_REPLAY",

  async handle({ message, reportProgress }) {
    const tenantContext = tenantContextFromMessage(message);
    const deadLetterItemId = String(message.payload.deadLetterItemId || "");

    if (!deadLetterItemId) {
      throw new RecoveryPermanentError(
        "deadLetterItemId is required for DEAD_LETTER_REPLAY jobs.",
        "DEAD_LETTER_ITEM_REQUIRED"
      );
    }

    await reportProgress(20, "Loading dead-letter item");

    const item = await getDeadLetterItemById({
      organisationId: tenantContext.organisationId,
      storeId: tenantContext.storeId,
      deadLetterItemId,
    });

    if (!item) {
      throw new RecoveryPermanentError(
        "Dead-letter item was not found.",
        "DEAD_LETTER_ITEM_NOT_FOUND"
      );
    }

    if (item.status !== "open") {
      return {
        resultReference: {
          deadLetterItemId,
          targetJobId: item.jobId,
          duplicate: true,
          status: item.status,
        },
      };
    }

    const targetQueueName = item.sourceQueue as JobQueueName;
    const targetJobType = item.jobType.toUpperCase() as AiventraJobType;

    await reportProgress(55, "Requeueing target job");

    const job = await createQueuedJob({
      tenantContext,
      jobType: targetJobType,
      queueName: targetQueueName,
      payload: {
        ...item.payload,
        tenantContext:
          item.payload.tenantContext || tenantPayload(tenantContext),
      },
      idempotencyKey: `dead-letter-replay:${deadLetterItemId}`,
    });

    if (!job.queueMessageId) {
      const queueMessageId = await enqueueJobMessage({
        queueName: targetQueueName,
        jobId: job.id,
        jobType: targetJobType,
        organisationId: tenantContext.organisationId,
        storeId: tenantContext.storeId,
        payload: {
          ...item.payload,
          tenantContext:
            item.payload.tenantContext || tenantPayload(tenantContext),
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
        message: "Dead-letter replay re-enqueued the original job.",
        context: {
          deadLetterItemId,
          targetJobType,
          targetQueueName,
          queueMessageId,
        },
      });
    }

    await markDeadLetterItemRequeued({
      deadLetterItemId,
      organisationId: tenantContext.organisationId,
      storeId: tenantContext.storeId,
    });

    await reportProgress(100, "Dead-letter replay queued");

    return {
      resultReference: {
        deadLetterItemId,
        targetJobId: job.id,
        targetJobType,
        targetQueueName,
      },
    };
  },
};
