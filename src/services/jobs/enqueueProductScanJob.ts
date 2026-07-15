import "server-only";

import type { TenantContext } from "@/context/storeContext";
import { tenantPayload } from "@/context/storeContext";
import { enqueueJobMessage } from "@/services/queues/jobQueue";
import {
  appendJobLog,
  createQueuedJob,
  failBackgroundJob,
  saveQueueMessageId,
} from "@/services/repositories/backgroundJobRepository";

export async function enqueueProductScanJob(input?: {
  tenantContext?: TenantContext;
  searchQuery?: string;
  correlationId?: string;
  causationId?: string;
  generateInsights?: boolean;
}) {
  if (!input?.tenantContext) {
    throw new Error("Tenant context is required to queue a product scan.");
  }

  const searchQuery = input?.searchQuery || "pet";
  const scanDay = new Date().toISOString().slice(0, 10);
  const idempotencyKey = `${input.tenantContext.organisationId}:${input.tenantContext.storeId}:PRODUCT_SCAN:${scanDay}:${searchQuery}`;
  const job = await createQueuedJob({
    tenantContext: input.tenantContext,
    jobType: "PRODUCT_SCAN",
    queueName: "aiventra-jobs",
    payload: {
      searchQuery,
      generateInsights: input?.generateInsights ?? true,
      tenantContext: tenantPayload(input.tenantContext),
    },
    idempotencyKey,
  });

  if (job.queueMessageId && job.status !== "failed" && job.status !== "dead_letter") {
    return {
      jobId: job.id,
      queueMessageId: job.queueMessageId,
      status: job.status,
    };
  }

  try {
    const queueMessageId = await enqueueJobMessage({
      queueName: "aiventra-jobs",
      jobId: job.id,
      jobType: "PRODUCT_SCAN",
      organisationId: input.tenantContext.organisationId,
      storeId: input.tenantContext.storeId,
      payload: {
        searchQuery,
        generateInsights: input?.generateInsights ?? true,
        tenantContext: tenantPayload(input.tenantContext),
      },
      correlationId: input?.correlationId,
      causationId: input?.causationId,
    });

    await saveQueueMessageId(job.id, queueMessageId);

    await appendJobLog({
      tenantContext: input.tenantContext,
      jobId: job.id,
      level: "info",
      step: "Queued",
      message: "Product scan queued.",
      context: {
        searchQuery,
        queueMessageId,
        tenantContext: tenantPayload(input.tenantContext),
      },
    });

    return {
      jobId: job.id,
      queueMessageId,
      status: "queued" as const,
    };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Failed to enqueue product scan.";

    await failBackgroundJob({
      jobId: job.id,
      attempt: 0,
      errorMessage,
    });

    throw error;
  }
}
