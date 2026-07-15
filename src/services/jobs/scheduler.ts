import "server-only";

import type { AiventraJobType } from "@/jobs/types";
import type { TenantContext } from "@/context/storeContext";
import { createQueuedJob, saveQueueMessageId } from "@/services/repositories/backgroundJobRepository";
import { enqueueJobMessage } from "@/services/queues/jobQueue";
import { supabaseAdmin } from "@/services/supabase/admin";
import { queueForJobType } from "./jobQueueRouting";

type ScheduledJobRow = {
  id: string;
  organisation_id: string;
  store_id: string;
  job_type: string;
  schedule: string;
  payload: Record<string, unknown> | null;
  next_run_at: string | null;
};

function tenantContextFromScheduledJob(row: ScheduledJobRow): TenantContext {
  return {
    organisationId: row.organisation_id,
    storeId: row.store_id,
    timezone: "Europe/London",
    currency: "GBP",
    locale: "en-GB",
  };
}

function parseJobType(value: string): AiventraJobType {
  return value.toUpperCase() as AiventraJobType;
}

function calculateNextRunAt(schedule: string, from = new Date()) {
  const parts = schedule.trim().split(/\s+/);
  const [minute = "0", hour = "*"] = parts;
  const next = new Date(from);

  if (minute.startsWith("*/")) {
    const intervalMinutes = Number(minute.slice(2)) || 5;
    next.setMinutes(next.getMinutes() + intervalMinutes, 0, 0);
    return next.toISOString();
  }

  if (hour !== "*") {
    next.setUTCDate(next.getUTCDate() + 1);
    next.setUTCHours(Number(hour) || 0, Number(minute) || 0, 0, 0);
    return next.toISOString();
  }

  next.setUTCHours(next.getUTCHours() + 1, Number(minute) || 0, 0, 0);
  return next.toISOString();
}

export async function enqueueDueScheduledJobs(input?: {
  limit?: number;
}): Promise<{
  enqueued: number;
  jobs: Array<{ scheduledJobId: string; jobId: string; queueMessageId: number }>;
}> {
  const now = new Date().toISOString();
  const { data, error } = await supabaseAdmin
    .from("scheduled_jobs")
    .select("id, organisation_id, store_id, job_type, schedule, payload, next_run_at")
    .eq("enabled", true)
    .lte("next_run_at", now)
    .order("next_run_at", { ascending: true })
    .limit(input?.limit || 10);

  if (error) {
    throw new Error(`Failed to load scheduled jobs: ${error.message}`);
  }

  const enqueuedJobs = [];

  for (const scheduledJob of (data || []) as ScheduledJobRow[]) {
    const jobType = parseJobType(scheduledJob.job_type);
    const queueName = queueForJobType(jobType);
    const tenantContext = tenantContextFromScheduledJob(scheduledJob);
    const idempotencyKey = [
      scheduledJob.organisation_id,
      scheduledJob.store_id,
      scheduledJob.job_type,
      scheduledJob.next_run_at || now,
      scheduledJob.id,
    ].join(":");

    const job = await createQueuedJob({
      tenantContext,
      jobType,
      queueName,
      payload: scheduledJob.payload || {},
      idempotencyKey,
    });

    if (!job.queueMessageId) {
      const queueMessageId = await enqueueJobMessage({
        queueName,
        jobId: job.id,
        jobType,
        organisationId: scheduledJob.organisation_id,
        storeId: scheduledJob.store_id,
        payload: scheduledJob.payload || {},
      });

      await saveQueueMessageId(job.id, queueMessageId);

      enqueuedJobs.push({
        scheduledJobId: scheduledJob.id,
        jobId: job.id,
        queueMessageId,
      });
    }

    await supabaseAdmin
      .from("scheduled_jobs")
      .update({
        last_enqueued_at: now,
        next_run_at: calculateNextRunAt(scheduledJob.schedule),
        updated_at: now,
      })
      .eq("id", scheduledJob.id);
  }

  return {
    enqueued: enqueuedJobs.length,
    jobs: enqueuedJobs,
  };
}
