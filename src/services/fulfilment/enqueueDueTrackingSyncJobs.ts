import "server-only";

import type { TenantContext } from "@/context/storeContext";
import { createQueuedJob, saveQueueMessageId } from "@/services/repositories/backgroundJobRepository";
import { enqueueJobMessage } from "@/services/queues/jobQueue";
import { supabaseAdmin } from "@/services/supabase/admin";

type DueTrackingRow = {
  id: string;
  organisation_id: string;
  store_id: string;
  external_order_id: string | null;
  currency: string | null;
  tracking_status: string | null;
  next_tracking_sync_at: string | null;
};

function tenantContextFromRow(row: DueTrackingRow): TenantContext {
  return {
    organisationId: row.organisation_id,
    storeId: row.store_id,
    timezone: "Europe/London",
    currency: row.currency || "GBP",
    locale: "en-GB",
  };
}

function hourBucket(date = new Date()) {
  return date.toISOString().slice(0, 13);
}

export async function enqueueDueTrackingSyncJobs(input?: {
  limit?: number;
}): Promise<{
  enqueued: number;
  jobs: Array<{ supplierOrderId: string; jobId: string; queueMessageId: number }>;
}> {
  const now = new Date();
  const nowIso = now.toISOString();
  const leaseUntil = new Date(now.getTime() + 30 * 60 * 1000).toISOString();

  const { data, error } = await supabaseAdmin
    .from("supplier_orders")
    .select(
      "id, organisation_id, store_id, external_order_id, currency, tracking_status, next_tracking_sync_at"
    )
    .not("next_tracking_sync_at", "is", null)
    .lte("next_tracking_sync_at", nowIso)
    .in("tracking_status", [
      "PENDING",
      "INFO_RECEIVED",
      "IN_TRANSIT",
      "OUT_FOR_DELIVERY",
      "EXCEPTION",
      "UNKNOWN",
    ])
    .order("next_tracking_sync_at", { ascending: true })
    .limit(input?.limit || 25);

  if (error) {
    throw new Error(`Failed to load due tracking syncs: ${error.message}`);
  }

  const jobs = [];

  for (const row of (data || []) as DueTrackingRow[]) {
    const { data: lockedRow, error: lockError } = await supabaseAdmin
      .from("supplier_orders")
      .update({
        next_tracking_sync_at: leaseUntil,
        tracking_sync_attempts: 1,
        updated_at: nowIso,
      })
      .eq("id", row.id)
      .eq("next_tracking_sync_at", row.next_tracking_sync_at)
      .select("id")
      .maybeSingle<{ id: string }>();

    if (lockError) {
      throw new Error(
        `Failed to lease supplier order for tracking sync: ${lockError.message}`
      );
    }

    if (!lockedRow) continue;

    const tenantContext = tenantContextFromRow(row);
    const idempotencyKey = `supplier-tracking:${row.id}:${hourBucket(now)}`;
    const job = await createQueuedJob({
      tenantContext,
      jobType: "SUPPLIER_TRACKING_SYNC",
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
      jobType: "SUPPLIER_TRACKING_SYNC",
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
