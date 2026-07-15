import "server-only";

import type { TenantContext } from "@/context/storeContext";
import { tenantPayload } from "@/context/storeContext";
import { enqueueJobMessage } from "@/services/queues/jobQueue";
import {
  appendJobLog,
  createQueuedJob,
  saveQueueMessageId,
} from "@/services/repositories/backgroundJobRepository";

export async function enqueueOrderValidationJob(input: {
  tenantContext: TenantContext;
  orderId: string;
  correlationId?: string;
  causationId?: string;
}) {
  const idempotencyKey = `${input.tenantContext.storeId}:${input.orderId}:order-validation`;
  const job = await createQueuedJob({
    tenantContext: input.tenantContext,
    jobType: "ORDER_VALIDATION",
    queueName: "aiventra-jobs",
    payload: {
      orderId: input.orderId,
      tenantContext: tenantPayload(input.tenantContext),
    },
    idempotencyKey,
  });

  if (job.queueMessageId) {
    return {
      jobId: job.id,
      queueMessageId: job.queueMessageId,
      status: job.status,
    };
  }

  const queueMessageId = await enqueueJobMessage({
    queueName: "aiventra-jobs",
    jobId: job.id,
    jobType: "ORDER_VALIDATION",
    organisationId: input.tenantContext.organisationId,
    storeId: input.tenantContext.storeId,
    payload: {
      orderId: input.orderId,
      tenantContext: tenantPayload(input.tenantContext),
    },
    correlationId: input.correlationId,
    causationId: input.causationId,
  });

  await saveQueueMessageId(job.id, queueMessageId);

  await appendJobLog({
    tenantContext: input.tenantContext,
    jobId: job.id,
    level: "info",
    step: "Queued",
    message: "Order validation queued.",
    context: {
      orderId: input.orderId,
      queueMessageId,
    },
  });

  return {
    jobId: job.id,
    queueMessageId,
    status: "queued" as const,
  };
}
