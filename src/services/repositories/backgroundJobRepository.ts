import "server-only";

import type {
  AiventraJobType,
  JobQueueName,
} from "@/jobs/types";
import type { JobStatus } from "@/jobs/status";
import type { TenantContext } from "@/context/storeContext";
import { tenantColumns } from "@/context/storeContext";
import { supabaseAdmin } from "@/services/supabase/admin";

export type BackgroundJob = {
  id: string;
  jobType?: string;
  organisationId?: string;
  storeId?: string;
  status: JobStatus;
  progress: number;
  currentStep?: string;
  queueName?: string;
  queueMessageId?: number;
  workerId?: string;
  attemptCount: number;
  maxAttempts: number;
  heartbeatAt?: string;
  nextRetryAt?: string;
  errorMessage?: string;
  resultReference: Record<string, unknown>;
  input: Record<string, unknown>;
  correlationId?: string;
  causationId?: string;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
};

type BackgroundJobRow = {
  id: string;
  job_type: string;
  organisation_id: string | null;
  store_id: string | null;
  status: JobStatus;
  progress: number;
  current_step: string | null;
  queue_name: string | null;
  queue_message_id: number | string | null;
  worker_id: string | null;
  attempt_count: number | string | null;
  max_attempts: number | string | null;
  heartbeat_at: string | null;
  next_retry_at: string | null;
  error_message: string | null;
  result_reference: Record<string, unknown> | null;
  input: Record<string, unknown> | null;
  correlation_id: string | null;
  causation_id: string | null;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
};

type JobLogRow = {
  id: number;
  level: "debug" | "info" | "warning" | "error";
  step: string | null;
  message: string;
  context: Record<string, unknown> | null;
  created_at: string;
};

function jobTypeToDatabase(jobType: AiventraJobType) {
  return jobType.toLowerCase();
}

function databaseJobTypeToJobType(jobType: string): AiventraJobType {
  return jobType.toUpperCase() as AiventraJobType;
}

function mapJob(row: BackgroundJobRow): BackgroundJob {
  return {
    id: row.id,
    jobType: databaseJobTypeToJobType(row.job_type),
    organisationId: row.organisation_id || undefined,
    storeId: row.store_id || undefined,
    status: row.status,
    progress: Number(row.progress || 0),
    currentStep: row.current_step || undefined,
    queueName: row.queue_name || undefined,
    queueMessageId:
      row.queue_message_id == null ? undefined : Number(row.queue_message_id),
    workerId: row.worker_id || undefined,
    attemptCount: Number(row.attempt_count || 0),
    maxAttempts: Number(row.max_attempts || 5),
    heartbeatAt: row.heartbeat_at || undefined,
    nextRetryAt: row.next_retry_at || undefined,
    errorMessage: row.error_message || undefined,
    resultReference: row.result_reference || {},
    input: row.input || {},
    correlationId: row.correlation_id || undefined,
    causationId: row.causation_id || undefined,
    createdAt: row.created_at,
    startedAt: row.started_at || undefined,
  completedAt: row.completed_at || undefined,
  };
}

function isUniqueViolation(error: { code?: string; message?: string }) {
  return (
    error.code === "23505" ||
    error.message?.toLowerCase().includes("duplicate key")
  );
}

const JOB_SELECT = `
  id,
  job_type,
  organisation_id,
  store_id,
  status,
  progress,
  current_step,
  queue_name,
  queue_message_id,
  worker_id,
  attempt_count,
  max_attempts,
  heartbeat_at,
  next_retry_at,
  error_message,
  result_reference,
  input,
  correlation_id,
  causation_id,
  created_at,
  started_at,
  completed_at
`;

async function getJobByIdempotencyKey(
  idempotencyKey: string
): Promise<BackgroundJob | null> {
  const { data, error } = await supabaseAdmin
    .from("ai_jobs")
    .select(JOB_SELECT)
    .eq("idempotency_key", idempotencyKey)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle<BackgroundJobRow>();

  if (error) {
    throw new Error(
      `Failed to load existing queued job: ${error.message}`
    );
  }

  return data ? mapJob(data) : null;
}

export async function createQueuedJob(input: {
  tenantContext: TenantContext;
  jobType: AiventraJobType;
  queueName: JobQueueName;
  payload?: Record<string, unknown>;
  idempotencyKey?: string;
  maxAttempts?: number;
}): Promise<BackgroundJob> {
  const correlationId = crypto.randomUUID();
  const row = {
    ...tenantColumns(input.tenantContext),
    job_type: jobTypeToDatabase(input.jobType),
    status: "queued",
    progress: 0,
    current_step: "Queued",
    queue_name: input.queueName,
    input: input.payload || {},
    correlation_id: correlationId,
    idempotency_key: input.idempotencyKey || null,
    max_attempts: input.maxAttempts || 5,
  };

  if (input.idempotencyKey) {
    const existing = await getJobByIdempotencyKey(input.idempotencyKey);

    if (existing) return existing;
  }

  const { data, error } = await supabaseAdmin
    .from("ai_jobs")
    .insert(row)
    .select(JOB_SELECT)
    .maybeSingle<BackgroundJobRow>();

  if (error) {
    if (input.idempotencyKey && isUniqueViolation(error)) {
      const existing = await getJobByIdempotencyKey(input.idempotencyKey);

      if (existing) return existing;
    }

    throw new Error(`Failed to create queued job: ${error.message}`);
  }

  if (data) return mapJob(data);

  throw new Error("The queued job was not created.");
}

export async function saveQueueMessageId(
  jobId: string,
  queueMessageId: number
): Promise<void> {
  const { error } = await supabaseAdmin
    .from("ai_jobs")
    .update({ queue_message_id: queueMessageId })
    .eq("id", jobId);

  if (error) {
    throw new Error(`Failed to save queue message id: ${error.message}`);
  }
}

export async function startJobAttempt(input: {
  tenantContext: TenantContext;
  jobId: string;
  workerId: string;
  attempt: number;
  step: string;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  const now = new Date().toISOString();

  const { error } = await supabaseAdmin.from("job_attempts").upsert(
    {
      ...tenantColumns(input.tenantContext),
      job_id: input.jobId,
      attempt_number: input.attempt,
      worker_id: input.workerId,
      step: input.step,
      status: "running",
      started_at: now,
      metadata: input.metadata || {},
    },
    {
      onConflict: "job_id,attempt_number",
    }
  );

  if (error) {
    throw new Error(`Failed to start job attempt: ${error.message}`);
  }
}

export async function markJobRunning(input: {
  tenantContext: TenantContext;
  jobId: string;
  workerId: string;
  attempt: number;
  currentStep: string;
}): Promise<void> {
  const now = new Date().toISOString();

  const { error } = await supabaseAdmin
    .from("ai_jobs")
    .update({
      status: "running",
      worker_id: input.workerId,
      current_step: input.currentStep,
      heartbeat_at: now,
      started_at: now,
      attempt_count: input.attempt,
    })
    .eq("id", input.jobId);

  if (error) {
    throw new Error(`Failed to mark job running: ${error.message}`);
  }

  await startJobAttempt({
    tenantContext: input.tenantContext,
    jobId: input.jobId,
    workerId: input.workerId,
    attempt: input.attempt,
    step: input.currentStep,
  });
}

export async function updateJobProgress(input: {
  jobId: string;
  workerId?: string;
  progress: number;
  currentStep?: string;
  step?: string;
  message?: string;
  tenantContext?: TenantContext;
}): Promise<void> {
  const currentStep = input.currentStep || input.step || "Running";
  const { error } = await supabaseAdmin
    .from("ai_jobs")
    .update({
      status: "running",
      progress: Math.max(0, Math.min(100, input.progress)),
      current_step: currentStep,
      worker_id: input.workerId,
      heartbeat_at: new Date().toISOString(),
    })
    .eq("id", input.jobId);

  if (error) {
    throw new Error(`Failed to update job: ${error.message}`);
  }

  if (input.message) {
    await appendJobLog({
      tenantContext: input.tenantContext,
      jobId: input.jobId,
      level: "info",
      step: currentStep,
      message: input.message,
    });
  }
}

export async function heartbeatJob(
  jobId: string,
  workerId?: string
): Promise<void> {
  const { error } = await supabaseAdmin
    .from("ai_jobs")
    .update({
      heartbeat_at: new Date().toISOString(),
      worker_id: workerId,
    })
    .eq("id", jobId)
    .eq("status", "running");

  if (error) {
    throw new Error(`Failed to heartbeat job: ${error.message}`);
  }
}

export async function completeJobAttempt(input: {
  jobId: string;
  attempt: number;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  const { error } = await supabaseAdmin
    .from("job_attempts")
    .update({
      status: "completed",
      completed_at: new Date().toISOString(),
      metadata: input.metadata || {},
    })
    .eq("job_id", input.jobId)
    .eq("attempt_number", input.attempt);

  if (error) {
    throw new Error(`Failed to complete job attempt: ${error.message}`);
  }
}

export async function failJobAttempt(input: {
  jobId: string;
  attempt: number;
  errorMessage: string;
  errorCode?: string;
  retryable?: boolean;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  const { error } = await supabaseAdmin
    .from("job_attempts")
    .update({
      status: "failed",
      error_code: input.errorCode || null,
      error_message: input.errorMessage,
      retryable: input.retryable,
      metadata: input.metadata || {},
      completed_at: new Date().toISOString(),
    })
    .eq("job_id", input.jobId)
    .eq("attempt_number", input.attempt);

  if (error) {
    throw new Error(`Failed to fail job attempt: ${error.message}`);
  }
}

export async function completeBackgroundJob(input: {
  jobId: string;
  attempt: number;
  resultReference?: Record<string, unknown>;
}): Promise<void> {
  const now = new Date().toISOString();

  const { error } = await supabaseAdmin
    .from("ai_jobs")
    .update({
      status: "completed",
      progress: 100,
      current_step: "Completed",
      result_reference: input.resultReference || {},
      output: input.resultReference || {},
      completed_at: now,
      heartbeat_at: now,
      next_retry_at: null,
    })
    .eq("id", input.jobId);

  if (error) {
    throw new Error(`Failed to complete job: ${error.message}`);
  }

  await completeJobAttempt({
    jobId: input.jobId,
    attempt: input.attempt,
    metadata: input.resultReference,
  });
}

export async function markJobRetrying(input: {
  jobId: string;
  attempt: number;
  errorMessage: string;
  nextRetryAt: string;
  retryable?: boolean;
}): Promise<void> {
  const now = new Date().toISOString();

  const { error } = await supabaseAdmin
    .from("ai_jobs")
    .update({
      status: "retrying",
      error_message: input.errorMessage,
      current_step: "Retrying",
      next_retry_at: input.nextRetryAt,
      heartbeat_at: now,
      worker_id: null,
    })
    .eq("id", input.jobId);

  if (error) {
    throw new Error(`Failed to retry job: ${error.message}`);
  }

  await failJobAttempt({
    jobId: input.jobId,
    attempt: input.attempt,
    errorMessage: input.errorMessage,
    retryable: input.retryable ?? true,
  });
}

export const retryBackgroundJob = markJobRetrying;

export async function rescheduleBackgroundJob(input: {
  jobId: string;
  nextRetryAt?: string;
  reason?: string;
}): Promise<void> {
  const { error } = await supabaseAdmin
    .from("ai_jobs")
    .update({
      status: "queued",
      current_step: input.reason || "Rescheduled",
      next_retry_at: input.nextRetryAt || null,
      worker_id: null,
      heartbeat_at: new Date().toISOString(),
    })
    .eq("id", input.jobId);

  if (error) {
    throw new Error(`Failed to reschedule job: ${error.message}`);
  }
}

export async function markJobDeadLetter(input: {
  jobId: string;
  attempt: number;
  errorMessage: string;
}): Promise<void> {
  await failBackgroundJob({
    jobId: input.jobId,
    attempt: input.attempt,
    errorMessage: input.errorMessage,
    deadLetter: true,
  });
}

export async function failBackgroundJob(input: {
  jobId: string;
  attempt: number;
  errorMessage: string;
  deadLetter?: boolean;
}): Promise<void> {
  const now = new Date().toISOString();

  const { error } = await supabaseAdmin
    .from("ai_jobs")
    .update({
      status: input.deadLetter ? "dead_letter" : "failed",
      current_step: input.deadLetter ? "Dead letter" : "Failed",
      error_message: input.errorMessage,
      completed_at: now,
      heartbeat_at: now,
      worker_id: null,
    })
    .eq("id", input.jobId);

  if (error) {
    throw new Error(`Failed to fail job: ${error.message}`);
  }

  if (input.attempt > 0) {
    await failJobAttempt({
      jobId: input.jobId,
      attempt: input.attempt,
      errorMessage: input.errorMessage,
      retryable: false,
    });
  }
}

export async function cancelBackgroundJob(input: {
  tenantContext: TenantContext;
  jobId: string;
  reason?: string;
}): Promise<void> {
  const { error } = await supabaseAdmin
    .from("ai_jobs")
    .update({
      status: "cancelled",
      current_step: "Cancelled",
      error_message: input.reason || null,
      completed_at: new Date().toISOString(),
      worker_id: null,
    })
    .eq("organisation_id", input.tenantContext.organisationId)
    .eq("store_id", input.tenantContext.storeId)
    .eq("id", input.jobId)
    .not("status", "in", "(completed,dead_letter)");

  if (error) {
    throw new Error(`Failed to cancel job: ${error.message}`);
  }
}

export async function appendJobLog(input: {
  tenantContext?: TenantContext;
  jobId: string;
  level: "debug" | "info" | "warning" | "error";
  step?: string;
  message: string;
  context?: Record<string, unknown>;
}): Promise<void> {
  const { error } = await supabaseAdmin.from("job_logs").insert({
    ...(input.tenantContext ? tenantColumns(input.tenantContext) : {}),
    job_id: input.jobId,
    level: input.level,
    step: input.step || null,
    message: input.message,
    context: input.context || {},
  });

  if (error) {
    console.error("Failed to append job log:", error.message);
  }
}

export async function getBackgroundJob(
  tenantContext: TenantContext,
  jobId: string
): Promise<BackgroundJob | null> {
  const { data, error } = await supabaseAdmin
    .from("ai_jobs")
    .select(JOB_SELECT)
    .eq("organisation_id", tenantContext.organisationId)
    .eq("store_id", tenantContext.storeId)
    .eq("id", jobId)
    .maybeSingle<BackgroundJobRow>();

  if (error) {
    throw new Error(`Failed to load job: ${error.message}`);
  }

  return data ? mapJob(data) : null;
}

export async function getLatestActiveJob(
  tenantContext: TenantContext
): Promise<BackgroundJob | null> {
  const { data, error } = await supabaseAdmin
    .from("ai_jobs")
    .select(JOB_SELECT)
    .eq("organisation_id", tenantContext.organisationId)
    .eq("store_id", tenantContext.storeId)
    .in("status", ["queued", "running", "retrying"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle<BackgroundJobRow>();

  if (error) {
    throw new Error(`Failed to load active job: ${error.message}`);
  }

  return data ? mapJob(data) : null;
}

export async function getJobLogs(
  tenantContext: TenantContext,
  jobId: string
): Promise<
  Array<{
    id: number;
    level: "debug" | "info" | "warning" | "error";
    step?: string;
    message: string;
    context: Record<string, unknown>;
    createdAt: string;
  }>
> {
  const { data, error } = await supabaseAdmin
    .from("job_logs")
    .select("id, level, step, message, context, created_at")
    .eq("organisation_id", tenantContext.organisationId)
    .eq("store_id", tenantContext.storeId)
    .eq("job_id", jobId)
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error(`Failed to load job logs: ${error.message}`);
  }

  return ((data || []) as JobLogRow[]).map((row) => ({
    id: row.id,
    level: row.level,
    step: row.step || undefined,
    message: row.message,
    context: row.context || {},
    createdAt: row.created_at,
  }));
}

export async function getJobOperationsSnapshot(
  tenantContext: TenantContext
): Promise<{
  counts: Record<JobStatus, number>;
  staleCount: number;
  jobs: BackgroundJob[];
}> {
  const { data, error } = await supabaseAdmin
    .from("ai_jobs")
    .select(JOB_SELECT)
    .eq("organisation_id", tenantContext.organisationId)
    .eq("store_id", tenantContext.storeId)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    throw new Error(`Failed to load job operations: ${error.message}`);
  }

  const jobs = ((data || []) as BackgroundJobRow[]).map(mapJob);
  const counts = {
    queued: 0,
    running: 0,
    retrying: 0,
    completed: 0,
    failed: 0,
    cancelled: 0,
    dead_letter: 0,
  } satisfies Record<JobStatus, number>;
  const staleBefore = Date.now() - 10 * 60 * 1000;

  for (const job of jobs) {
    counts[job.status] += 1;
  }

  return {
    counts,
    staleCount: jobs.filter(
      (job) =>
        job.status === "running" &&
        job.heartbeatAt &&
        new Date(job.heartbeatAt).getTime() < staleBefore
    ).length,
    jobs,
  };
}

export async function findStaleRunningJobs(input?: {
  olderThanMinutes?: number;
  limit?: number;
}): Promise<BackgroundJob[]> {
  const staleBefore = new Date(
    Date.now() - (input?.olderThanMinutes || 10) * 60 * 1000
  ).toISOString();

  const { data, error } = await supabaseAdmin
    .from("ai_jobs")
    .select(JOB_SELECT)
    .eq("status", "running")
    .lt("heartbeat_at", staleBefore)
    .limit(input?.limit || 25);

  if (error) {
    throw new Error(`Failed to load stale jobs: ${error.message}`);
  }

  return ((data || []) as BackgroundJobRow[]).map(mapJob);
}
