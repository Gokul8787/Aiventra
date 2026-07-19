import "server-only";

import type { TenantContext } from "@/context/storeContext";
import { tenantPayload } from "@/context/storeContext";
import { enqueueJobMessage } from "@/services/queues/jobQueue";
import {
  appendJobLog,
  createQueuedJob,
  saveQueueMessageId,
} from "@/services/repositories/backgroundJobRepository";

export async function enqueuePlatformFulfilmentJob(input: {
  tenantContext: TenantContext;
  orderId: string;
  shipmentTrackingId: string;
  supplierOrderId?: string;
  correlationId?: string;
  causationId?: string;
}) {
  const idempotencyKey = [
    input.tenantContext.organisationId,
    input.tenantContext.storeId,
    input.shipmentTrackingId,
    "shopify-fulfilment",
  ].join(":");

  const job = await createQueuedJob({
    tenantContext: input.tenantContext,
    jobType: "SHOPIFY_FULFILMENT",
    queueName: "aiventra-shopify",
    payload: {
      orderId: input.orderId,
      shipmentTrackingId: input.shipmentTrackingId,
      supplierOrderId: input.supplierOrderId,
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
    queueName: "aiventra-shopify",
    jobId: job.id,
    jobType: "SHOPIFY_FULFILMENT",
    organisationId: input.tenantContext.organisationId,
    storeId: input.tenantContext.storeId,
    payload: {
      orderId: input.orderId,
      shipmentTrackingId: input.shipmentTrackingId,
      supplierOrderId: input.supplierOrderId,
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
    message: "Platform fulfilment job queued.",
    context: {
      orderId: input.orderId,
      shipmentTrackingId: input.shipmentTrackingId,
      supplierOrderId: input.supplierOrderId,
      queueMessageId,
    },
  });

  return {
    jobId: job.id,
    queueMessageId,
    status: "queued" as const,
  };
}
