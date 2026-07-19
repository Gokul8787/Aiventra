import "server-only";

import type { TenantContext } from "@/context/storeContext";
import { tenantPayload } from "@/context/storeContext";
import { enqueueJobMessage } from "@/services/queues/jobQueue";
import {
  appendJobLog,
  createQueuedJob,
  saveQueueMessageId,
} from "@/services/repositories/backgroundJobRepository";

export async function enqueueSupplierOrderCreationJob(input: {
  tenantContext: TenantContext;
  orderId: string;
  approved?: boolean;
  correlationId?: string;
  causationId?: string;
}) {
  const idempotencyKey = `${input.tenantContext.organisationId}:${input.tenantContext.storeId}:${input.orderId}:supplier-order-creation`;
  const job = await createQueuedJob({
    tenantContext: input.tenantContext,
    jobType: "SUPPLIER_ORDER_CREATION",
    queueName: "aiventra-cj",
    payload: {
      orderId: input.orderId,
      approved: input.approved || false,
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
    queueName: "aiventra-cj",
    jobId: job.id,
    jobType: "SUPPLIER_ORDER_CREATION",
    organisationId: input.tenantContext.organisationId,
    storeId: input.tenantContext.storeId,
    payload: {
      orderId: input.orderId,
      approved: input.approved || false,
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
    message: "Supplier order creation queued.",
    context: {
      orderId: input.orderId,
      approved: input.approved || false,
      queueMessageId,
    },
  });

  return {
    jobId: job.id,
    queueMessageId,
    status: "queued" as const,
  };
}

export async function enqueueSupplierOrderStatusSyncJob(input: {
  tenantContext: TenantContext;
  supplierOrderId: string;
  externalOrderId?: string;
  correlationId?: string;
  causationId?: string;
  delaySeconds?: number;
  idempotencyKeySuffix?: string;
}) {
  const idempotencyKey = [
    input.tenantContext.organisationId,
    input.tenantContext.storeId,
    input.supplierOrderId,
    "supplier-order-status-sync",
    input.idempotencyKeySuffix,
  ]
    .filter(Boolean)
    .join(":");
  const job = await createQueuedJob({
    tenantContext: input.tenantContext,
    jobType: "SUPPLIER_ORDER_STATUS_SYNC",
    queueName: "aiventra-cj",
    payload: {
      supplierOrderId: input.supplierOrderId,
      externalOrderId: input.externalOrderId,
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
    queueName: "aiventra-cj",
    jobId: job.id,
    jobType: "SUPPLIER_ORDER_STATUS_SYNC",
    organisationId: input.tenantContext.organisationId,
    storeId: input.tenantContext.storeId,
    payload: {
      supplierOrderId: input.supplierOrderId,
      externalOrderId: input.externalOrderId,
      delaySeconds: input.delaySeconds,
      tenantContext: tenantPayload(input.tenantContext),
    },
    correlationId: input.correlationId,
    causationId: input.causationId,
    delaySeconds: input.delaySeconds,
  });

  await saveQueueMessageId(job.id, queueMessageId);

  await appendJobLog({
    tenantContext: input.tenantContext,
    jobId: job.id,
    level: "info",
    step: "Queued",
    message: "Supplier order status sync queued.",
    context: {
      supplierOrderId: input.supplierOrderId,
      externalOrderId: input.externalOrderId,
      delaySeconds: input.delaySeconds,
      queueMessageId,
    },
  });

  return {
    jobId: job.id,
    queueMessageId,
    status: "queued" as const,
  };
}

export async function enqueueSupplierTrackingSyncJob(input: {
  tenantContext: TenantContext;
  supplierOrderId: string;
  externalOrderId?: string;
  correlationId?: string;
  causationId?: string;
  delaySeconds?: number;
  idempotencyKeySuffix?: string;
}) {
  const idempotencyKey = [
    input.tenantContext.organisationId,
    input.tenantContext.storeId,
    input.supplierOrderId,
    "supplier-tracking-sync",
    input.idempotencyKeySuffix,
  ]
    .filter(Boolean)
    .join(":");
  const job = await createQueuedJob({
    tenantContext: input.tenantContext,
    jobType: "SUPPLIER_TRACKING_SYNC",
    queueName: "aiventra-cj",
    payload: {
      supplierOrderId: input.supplierOrderId,
      externalOrderId: input.externalOrderId,
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
    queueName: "aiventra-cj",
    jobId: job.id,
    jobType: "SUPPLIER_TRACKING_SYNC",
    organisationId: input.tenantContext.organisationId,
    storeId: input.tenantContext.storeId,
    payload: {
      supplierOrderId: input.supplierOrderId,
      externalOrderId: input.externalOrderId,
      delaySeconds: input.delaySeconds,
      tenantContext: tenantPayload(input.tenantContext),
    },
    correlationId: input.correlationId,
    causationId: input.causationId,
    delaySeconds: input.delaySeconds,
  });

  await saveQueueMessageId(job.id, queueMessageId);

  await appendJobLog({
    tenantContext: input.tenantContext,
    jobId: job.id,
    level: "info",
    step: "Queued",
    message: "Supplier tracking sync queued.",
    context: {
      supplierOrderId: input.supplierOrderId,
      externalOrderId: input.externalOrderId,
      delaySeconds: input.delaySeconds,
      queueMessageId,
    },
  });

  return {
    jobId: job.id,
    queueMessageId,
    status: "queued" as const,
  };
}
