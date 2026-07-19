import "server-only";

import type { TenantContext } from "@/context/storeContext";
import { tenantPayload } from "@/context/storeContext";
import type { ProductScanRequest } from "@/services/productDiscovery/productScanRequest";
import {
  getProductScanSearchLabel,
  parseProductScanRequest,
} from "@/services/productDiscovery/productScanRequest";
import {
  enqueueJobMessage,
  isQueueUnavailableError,
} from "@/services/queues/jobQueue";
import { handleProductScanJob } from "@/jobs/handlers/productScanJobHandler";
import {
  appendJobLog,
  completeBackgroundJob,
  createQueuedJob,
  failBackgroundJob,
  markJobRunning,
  saveQueueMessageId,
} from "@/services/repositories/backgroundJobRepository";

export async function enqueueProductScanJob(input?: {
  tenantContext?: TenantContext;
  request?: ProductScanRequest;
  mode?: ProductScanRequest["mode"];
  categoryId?: string;
  keyword?: string;
  searchQuery?: string;
  correlationId?: string;
  causationId?: string;
  generateInsights?: boolean;
}) {
  if (!input?.tenantContext) {
    throw new Error("Tenant context is required to queue a product scan.");
  }

  const request = parseProductScanRequest(
    input.request || {
      mode: input.mode || (input.searchQuery ? "keyword" : "broad"),
      categoryId: input.categoryId,
      keyword: input.keyword || input.searchQuery,
    }
  );
  const searchQuery = getProductScanSearchLabel(request);
  const scanDay = new Date().toISOString().slice(0, 10);
  const idempotencyKey = `${input.tenantContext.organisationId}:${input.tenantContext.storeId}:PRODUCT_SCAN:${scanDay}:${request.mode}:${searchQuery}`;
  const job = await createQueuedJob({
    tenantContext: input.tenantContext,
    jobType: "PRODUCT_SCAN",
    queueName: "aiventra-jobs",
    payload: {
      request,
      mode: request.mode,
      categoryId: request.categoryId,
      keyword: request.keyword,
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
        request,
        mode: request.mode,
        categoryId: request.categoryId,
        keyword: request.keyword,
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
        request,
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

    if (isQueueUnavailableError(error)) {
      const workerId = `aiventra-inline-${crypto.randomUUID()}`;

      await appendJobLog({
        tenantContext: input.tenantContext,
        jobId: job.id,
        level: "warning",
        step: "Queue unavailable",
        message:
          "Supabase Queues are unavailable. Running product scan inline.",
        context: {
          errorMessage,
          request,
          searchQuery,
        },
      });

      try {
        await markJobRunning({
          tenantContext: input.tenantContext,
          jobId: job.id,
          workerId,
          attempt: 1,
          currentStep: "Starting inline scan",
        });

        const resultReference = await handleProductScanJob({
          tenantContext: input.tenantContext,
          jobId: job.id,
          request,
          searchQuery,
          generateInsights: input?.generateInsights ?? true,
        });

        await completeBackgroundJob({
          jobId: job.id,
          attempt: 1,
          resultReference,
        });

        await appendJobLog({
          tenantContext: input.tenantContext,
          jobId: job.id,
          level: "info",
          step: "Completed",
          message: "Product scan completed inline.",
          context: resultReference,
        });

        return {
          jobId: job.id,
          status: "completed" as const,
        };
      } catch (inlineError) {
        await failBackgroundJob({
          jobId: job.id,
          attempt: 1,
          errorMessage:
            inlineError instanceof Error
              ? inlineError.message
              : "Inline product scan failed.",
        });

        throw inlineError;
      }
    }

    await failBackgroundJob({
      jobId: job.id,
      attempt: 0,
      errorMessage,
    });

    throw error;
  }
}
