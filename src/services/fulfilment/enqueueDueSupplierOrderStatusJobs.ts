import "server-only";

import type { TenantContext } from "@/context/storeContext";
import { createQueuedJob, saveQueueMessageId } from "@/services/repositories/backgroundJobRepository";
import { enqueueJobMessage } from "@/services/queues/jobQueue";
import { supabaseAdmin } from "@/services/supabase/admin";

type DueSupplierOrderRow = {
  id: string;
  organisation_id: string;
  store_id: string;
  external_order_id: string | null;
  status: string;
  next_status_sync_at: string | null;
};

function tenantContextFromRow(row: DueSupplierOrderRow): TenantContext {
  return {
    organisationId: row.organisation_id,
    storeId: row.store_id,
    timezone: "Europe/London",
    currency: "GBP",
    locale: "en-GB",
  };
}

function hourBucket(date = new Date()) {
  return date.toISOString().slice(0, 13);
}

export async function enqueueDueSupplierOrderStatusJobs(input?: {
  limit?: number;
}): Promise<{
  enqueued: number;
  jobs: Array<{ supplierOrderId: string; jobId: string; queueMessageId: number }>;
}> {
  const now = new Date();
  const nowIso = now.toISOString();
  const leaseUntil = new Date(now.getTime() + 5 * 60 * 1000).toISOString();
  const { data, error } = await supabaseAdmin
    .from("supplier_orders")
    .select("id, organisation_id, store_id, external_order_id, status, next_status_sync_at")
    .in("status", ["CREATED", "AWAITING_PAYMENT", "PAID", "PROCESSING", "SHIPPED"])
    .lte("next_status_sync_at", nowIso)
    .order("next_status_sync_at", { ascending: true })
    .limit(input?.limit || 20);

  if (error) {
    throw new Error(
      `Failed to load due supplier order status jobs: ${error.message}`
    );
  }

  const jobs = [];

  for (const row of (data || []) as DueSupplierOrderRow[]) {
    const { data: lockedRow, error: lockError } = await supabaseAdmin
      .from("supplier_orders")
      .update({
        next_status_sync_at: leaseUntil,
        status_sync_attempts: 1,
        updated_at: nowIso,
      })
      .eq("id", row.id)
      .eq("next_status_sync_at", row.next_status_sync_at)
      .eq("status", row.status)
      .select("id")
      .maybeSingle<{ id: string }>();

    if (lockError) {
      throw new Error(
        `Failed to lease supplier order for status sync: ${lockError.message}`
      );
    }

    if (!lockedRow) continue;

    const tenantContext = tenantContextFromRow(row);
    const idempotencyKey = `supplier-order-status:${row.id}:${hourBucket(now)}`;
    const job = await createQueuedJob({
      tenantContext,
      jobType: "SUPPLIER_ORDER_STATUS_SYNC",
      queueName: "aiventra-cj",
      payload: {
        supplierOrderId: row.id,
        externalOrderId: row.external_order_id || undefined,
      },
      idempotencyKey,
    });

    if (job.queueMessageId) {
      jobs.push({
        supplierOrderId: row.id,
        jobId: job.id,
        queueMessageId: job.queueMessageId,
      });
      continue;
    }

    const queueMessageId = await enqueueJobMessage({
      queueName: "aiventra-cj",
      jobId: job.id,
      jobType: "SUPPLIER_ORDER_STATUS_SYNC",
      organisationId: row.organisation_id,
      storeId: row.store_id,
      payload: {
        supplierOrderId: row.id,
        externalOrderId: row.external_order_id || undefined,
      },
    });

    await saveQueueMessageId(job.id, queueMessageId);

    jobs.push({
      supplierOrderId: row.id,
      jobId: job.id,
      queueMessageId,
    });
  }

  return {
    enqueued: jobs.length,
    jobs,
  };
}
