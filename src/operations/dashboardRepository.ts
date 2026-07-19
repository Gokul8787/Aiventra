import "server-only";

import type { TenantContext } from "@/context/storeContext";
import { tenantColumns } from "@/context/storeContext";
import type { JobStatus } from "@/jobs/status";
import type { OperationsAlertSeverity } from "@/recovery/types";
import { supabaseAdmin } from "@/services/supabase/admin";

export type OperationsJobRow = {
  id: string;
  queueName?: string;
  status: JobStatus;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  heartbeatAt?: string;
  workerId?: string;
};

export type WorkerHeartbeatRow = {
  workerKey: string;
  workerId: string;
  queueName: string;
  version: string;
  host?: string;
  status?: string;
  memoryMb?: number;
  cpuPercent?: number;
  heartbeatAt: string;
  metadata: Record<string, unknown>;
};

export type DashboardProviderHealthRow = {
  provider: string;
  category: string;
  status: "healthy" | "degraded" | "failed" | "quota_low";
  lastSuccessAt?: string;
  lastFailureAt?: string;
  latencyMs: number;
  cost: number;
  quotaRemaining?: number;
  version: string;
  checkedAt: string;
  availability?: number;
  errorRate?: number;
  rateLimitRemaining?: number;
  apiPointsRemaining?: number;
  statusMessage?: string;
  metadata: Record<string, unknown>;
};

export type DashboardAlertRow = {
  id: string;
  severity: OperationsAlertSeverity;
  category: string;
  title: string;
  message: string;
  status: string;
  resourceType?: string;
  resourceId?: string;
  createdAt: string;
  metadata: Record<string, unknown>;
};

export type DashboardDeadLetterRow = {
  id: string;
  sourceQueue: string;
  jobId?: string;
  cancellationRequestId?: string;
  jobType: string;
  payload: Record<string, unknown>;
  errorCode?: string;
  errorMessage?: string;
  attemptCount: number;
  maxAttempts: number;
  status: "open" | "requeued" | "resolved" | "ignored";
  createdAt: string;
};

export type DashboardRecoveryRow = {
  id: string;
  orderId: string;
  status: string;
  decision?: string;
  confidence?: number;
  requestedAt: string;
  completedAt?: string;
  nextRetryAt?: string;
};

export type DashboardOrderMetricRow = {
  id: string;
  status: string;
  total: number;
  createdAt: string;
  cancelledAt?: string;
  refundedAt?: string;
};

export type DashboardOrderItemMetricRow = {
  profit: number;
  cost: number;
  createdAt: string;
};

export type DashboardSupplierOrderMetricRow = {
  status: string;
  createdAt: string;
  submittedAt?: string;
  updatedAt: string;
};

export type DashboardPlatformFulfilmentMetricRow = {
  status: string;
  createdAt: string;
  fulfilledAt?: string;
  updatedAt: string;
};

export type DashboardRawData = {
  jobs: OperationsJobRow[];
  workerHeartbeats: WorkerHeartbeatRow[];
  providerHealth: DashboardProviderHealthRow[];
  alerts: DashboardAlertRow[];
  deadLetters: DashboardDeadLetterRow[];
  recovery: DashboardRecoveryRow[];
  orders: DashboardOrderMetricRow[];
  orderItemsToday: DashboardOrderItemMetricRow[];
  supplierOrders: DashboardSupplierOrderMetricRow[];
  platformFulfilments: DashboardPlatformFulfilmentMetricRow[];
};

function toNumber(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export async function loadDashboardRawData(
  tenantContext: TenantContext
): Promise<DashboardRawData> {
  const thirtyDaysAgo = new Date(
    Date.now() - 30 * 24 * 60 * 60 * 1000
  ).toISOString();
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  const [
    jobsResult,
    workerHeartbeatsResult,
    providerHealthResult,
    alertsResult,
    deadLettersResult,
    recoveryResult,
    ordersResult,
    orderItemsTodayResult,
    supplierOrdersResult,
    platformFulfilmentsResult,
  ] = await Promise.all([
    supabaseAdmin
      .from("ai_jobs")
      .select(
        "id, queue_name, status, created_at, started_at, completed_at, heartbeat_at, worker_id"
      )
      .eq("organisation_id", tenantContext.organisationId)
      .eq("store_id", tenantContext.storeId)
      .gte("created_at", thirtyDaysAgo)
      .order("created_at", { ascending: false })
      .limit(1000),
    supabaseAdmin
      .from("worker_heartbeats")
      .select(
        "worker_key, worker_id, queue_name, version, host, status, memory_mb, cpu_percent, heartbeat_at, metadata, organisation_id, store_id"
      )
      .order("heartbeat_at", { ascending: false })
      .limit(100),
    supabaseAdmin
      .from("provider_health")
      .select(
        "provider, category, status, last_success_at, last_failure_at, latency_ms, cost, quota_remaining, version, checked_at, availability, error_rate, rate_limit_remaining, api_points_remaining, status_message, metadata"
      )
      .eq("organisation_id", tenantContext.organisationId)
      .eq("store_id", tenantContext.storeId)
      .order("checked_at", { ascending: false })
      .limit(100),
    supabaseAdmin
      .from("operations_alerts")
      .select(
        "id, severity, category, title, message, status, resource_type, resource_id, created_at, metadata"
      )
      .eq("organisation_id", tenantContext.organisationId)
      .eq("store_id", tenantContext.storeId)
      .order("created_at", { ascending: false })
      .limit(25),
    supabaseAdmin
      .from("dead_letter_items")
      .select(
        "id, source_queue, job_id, cancellation_request_id, job_type, payload, error_code, error_message, attempt_count, max_attempts, status, created_at"
      )
      .eq("organisation_id", tenantContext.organisationId)
      .eq("store_id", tenantContext.storeId)
      .order("created_at", { ascending: false })
      .limit(25),
    supabaseAdmin
      .from("cancellation_requests")
      .select(
        "id, order_id, status, decision, confidence, requested_at, completed_at, next_retry_at"
      )
      .eq("organisation_id", tenantContext.organisationId)
      .eq("store_id", tenantContext.storeId)
      .order("requested_at", { ascending: false })
      .limit(50),
    supabaseAdmin
      .from("orders")
      .select("id, status, total, created_at, cancelled_at, refunded_at")
      .eq("organisation_id", tenantContext.organisationId)
      .eq("store_id", tenantContext.storeId)
      .gte("created_at", thirtyDaysAgo)
      .order("created_at", { ascending: false })
      .limit(500),
    supabaseAdmin
      .from("order_items")
      .select("profit, cost, created_at")
      .eq("organisation_id", tenantContext.organisationId)
      .eq("store_id", tenantContext.storeId)
      .gte("created_at", startOfToday.toISOString())
      .order("created_at", { ascending: false })
      .limit(500),
    supabaseAdmin
      .from("supplier_orders")
      .select("status, created_at, submitted_at, updated_at")
      .eq("organisation_id", tenantContext.organisationId)
      .eq("store_id", tenantContext.storeId)
      .gte("created_at", thirtyDaysAgo)
      .order("created_at", { ascending: false })
      .limit(500),
    supabaseAdmin
      .from("platform_fulfilments")
      .select("status, created_at, fulfilled_at, updated_at")
      .eq("organisation_id", tenantContext.organisationId)
      .eq("store_id", tenantContext.storeId)
      .gte("created_at", thirtyDaysAgo)
      .order("created_at", { ascending: false })
      .limit(500),
  ]);

  const errors = [
    jobsResult.error,
    workerHeartbeatsResult.error,
    providerHealthResult.error,
    alertsResult.error,
    deadLettersResult.error,
    recoveryResult.error,
    ordersResult.error,
    orderItemsTodayResult.error,
    supplierOrdersResult.error,
    platformFulfilmentsResult.error,
  ].filter(Boolean);

  if (errors.length > 0) {
    throw new Error(
      `Failed to load operations dashboard: ${errors[0]?.message || "Unknown error"}`
    );
  }

  return {
    jobs: ((jobsResult.data || []) as Array<{
      id: string;
      queue_name: string | null;
      status: JobStatus;
      created_at: string;
      started_at: string | null;
      completed_at: string | null;
      heartbeat_at: string | null;
      worker_id: string | null;
    }>).map((row) => ({
      id: row.id,
      queueName: row.queue_name || undefined,
      status: row.status,
      createdAt: row.created_at,
      startedAt: row.started_at || undefined,
      completedAt: row.completed_at || undefined,
      heartbeatAt: row.heartbeat_at || undefined,
      workerId: row.worker_id || undefined,
    })),
    workerHeartbeats: ((workerHeartbeatsResult.data || []) as Array<{
      worker_key: string;
      worker_id: string;
      queue_name: string;
      version: string;
      host: string | null;
      status: string | null;
      memory_mb: number | string | null;
      cpu_percent: number | string | null;
      heartbeat_at: string;
      metadata: Record<string, unknown> | null;
      organisation_id: string | null;
      store_id: string | null;
    }>)
      .filter(
        (row) =>
          (!row.organisation_id && !row.store_id) ||
          (row.organisation_id === tenantContext.organisationId &&
            row.store_id === tenantContext.storeId)
      )
      .map((row) => ({
        workerKey: row.worker_key,
        workerId: row.worker_id,
        queueName: row.queue_name,
        version: row.version,
        host: row.host || undefined,
        status: row.status || undefined,
        memoryMb:
          row.memory_mb == null ? undefined : Number(row.memory_mb || 0),
        cpuPercent:
          row.cpu_percent == null ? undefined : Number(row.cpu_percent || 0),
        heartbeatAt: row.heartbeat_at,
        metadata: row.metadata || {},
      })),
    providerHealth: ((providerHealthResult.data || []) as Array<{
      provider: string;
      category: string;
      status: DashboardProviderHealthRow["status"];
      last_success_at: string | null;
      last_failure_at: string | null;
      latency_ms: number | string;
      cost: number | string;
      quota_remaining: number | string | null;
      version: string;
      checked_at: string;
      availability: number | string | null;
      error_rate: number | string | null;
      rate_limit_remaining: number | string | null;
      api_points_remaining: number | string | null;
      status_message: string | null;
      metadata: Record<string, unknown> | null;
    }>).map((row) => ({
      provider: row.provider,
      category: row.category,
      status: row.status,
      lastSuccessAt: row.last_success_at || undefined,
      lastFailureAt: row.last_failure_at || undefined,
      latencyMs: toNumber(row.latency_ms),
      cost: toNumber(row.cost),
      quotaRemaining:
        row.quota_remaining == null ? undefined : toNumber(row.quota_remaining),
      version: row.version,
      checkedAt: row.checked_at,
      availability:
        row.availability == null ? undefined : toNumber(row.availability),
      errorRate:
        row.error_rate == null ? undefined : toNumber(row.error_rate),
      rateLimitRemaining:
        row.rate_limit_remaining == null
          ? undefined
          : toNumber(row.rate_limit_remaining),
      apiPointsRemaining:
        row.api_points_remaining == null
          ? undefined
          : toNumber(row.api_points_remaining),
      statusMessage: row.status_message || undefined,
      metadata: row.metadata || {},
    })),
    alerts: ((alertsResult.data || []) as Array<{
      id: string;
      severity: OperationsAlertSeverity;
      category: string;
      title: string;
      message: string;
      status: string;
      resource_type: string | null;
      resource_id: string | null;
      created_at: string;
      metadata: Record<string, unknown> | null;
    }>).map((row) => ({
      id: row.id,
      severity: row.severity,
      category: row.category,
      title: row.title,
      message: row.message,
      status: row.status,
      resourceType: row.resource_type || undefined,
      resourceId: row.resource_id || undefined,
      createdAt: row.created_at,
      metadata: row.metadata || {},
    })),
    deadLetters: ((deadLettersResult.data || []) as Array<{
      id: string;
      source_queue: string;
      job_id: string | null;
      cancellation_request_id: string | null;
      job_type: string;
      payload: Record<string, unknown> | null;
      error_code: string | null;
      error_message: string | null;
      attempt_count: number | string;
      max_attempts: number | string;
      status: DashboardDeadLetterRow["status"];
      created_at: string;
    }>).map((row) => ({
      id: row.id,
      sourceQueue: row.source_queue,
      jobId: row.job_id || undefined,
      cancellationRequestId: row.cancellation_request_id || undefined,
      jobType: row.job_type,
      payload: row.payload || {},
      errorCode: row.error_code || undefined,
      errorMessage: row.error_message || undefined,
      attemptCount: toNumber(row.attempt_count),
      maxAttempts: toNumber(row.max_attempts),
      status: row.status,
      createdAt: row.created_at,
    })),
    recovery: ((recoveryResult.data || []) as Array<{
      id: string;
      order_id: string;
      status: string;
      decision: string | null;
      confidence: number | string | null;
      requested_at: string;
      completed_at: string | null;
      next_retry_at: string | null;
    }>).map((row) => ({
      id: row.id,
      orderId: row.order_id,
      status: row.status,
      decision: row.decision || undefined,
      confidence:
        row.confidence == null ? undefined : toNumber(row.confidence),
      requestedAt: row.requested_at,
      completedAt: row.completed_at || undefined,
      nextRetryAt: row.next_retry_at || undefined,
    })),
    orders: ((ordersResult.data || []) as Array<{
      id: string;
      status: string;
      total: number | string;
      created_at: string;
      cancelled_at: string | null;
      refunded_at: string | null;
    }>).map((row) => ({
      id: row.id,
      status: row.status,
      total: toNumber(row.total),
      createdAt: row.created_at,
      cancelledAt: row.cancelled_at || undefined,
      refundedAt: row.refunded_at || undefined,
    })),
    orderItemsToday: ((orderItemsTodayResult.data || []) as Array<{
      profit: number | string | null;
      cost: number | string | null;
      created_at: string;
    }>).map((row) => ({
      profit: toNumber(row.profit),
      cost: toNumber(row.cost),
      createdAt: row.created_at,
    })),
    supplierOrders: ((supplierOrdersResult.data || []) as Array<{
      status: string;
      created_at: string;
      submitted_at: string | null;
      updated_at: string;
    }>).map((row) => ({
      status: row.status,
      createdAt: row.created_at,
      submittedAt: row.submitted_at || undefined,
      updatedAt: row.updated_at,
    })),
    platformFulfilments: ((platformFulfilmentsResult.data || []) as Array<{
      status: string;
      created_at: string;
      fulfilled_at: string | null;
      updated_at: string;
    }>).map((row) => ({
      status: row.status,
      createdAt: row.created_at,
      fulfilledAt: row.fulfilled_at || undefined,
      updatedAt: row.updated_at,
    })),
  };
}

export async function saveQueueMetrics(input: {
  tenantContext: TenantContext;
  rows: Array<{
    queueName: string;
    queued: number;
    running: number;
    retrying: number;
    completed: number;
    failed: number;
    cancelled: number;
    deadLetter: number;
    oldestMessageAgeSeconds: number;
    messagesPerHour: number;
    failuresPerHour: number;
    averageProcessingTimeMs: number;
    staleJobs: number;
  }>;
}) {
  if (input.rows.length === 0) return;

  const { error } = await supabaseAdmin.from("queue_metrics").insert(
    input.rows.map((row) => ({
      ...tenantColumns(input.tenantContext),
      queue_name: row.queueName,
      queued: row.queued,
      running: row.running,
      retrying: row.retrying,
      completed: row.completed,
      failed: row.failed,
      cancelled: row.cancelled,
      dead_letter: row.deadLetter,
      oldest_message_age_seconds: row.oldestMessageAgeSeconds,
      messages_per_hour: row.messagesPerHour,
      failures_per_hour: row.failuresPerHour,
      average_processing_time_ms: row.averageProcessingTimeMs,
      stale_jobs: row.staleJobs,
    }))
  );

  if (error) {
    throw new Error(`Failed to save queue metrics: ${error.message}`);
  }
}

export async function saveSystemMetrics(input: {
  tenantContext: TenantContext;
  rows: Array<{
    key: string;
    value: number;
    unit?: string;
    metadata?: Record<string, unknown>;
  }>;
}) {
  if (input.rows.length === 0) return;

  const { error } = await supabaseAdmin.from("system_metrics").insert(
    input.rows.map((row) => ({
      ...tenantColumns(input.tenantContext),
      metric_key: row.key,
      metric_value: row.value,
      metric_unit: row.unit || null,
      metadata: row.metadata || {},
    }))
  );

  if (error) {
    throw new Error(`Failed to save system metrics: ${error.message}`);
  }
}

export async function saveOperationSnapshot(input: {
  tenantContext: TenantContext;
  snapshotKey?: string;
  payload: Record<string, unknown>;
}) {
  const { error } = await supabaseAdmin.from("operation_snapshots").upsert(
    {
      ...tenantColumns(input.tenantContext),
      snapshot_key: input.snapshotKey || "operations",
      payload: input.payload,
      generated_at: new Date().toISOString(),
    },
    {
      onConflict: "organisation_id,store_id,snapshot_key",
    }
  );

  if (error) {
    throw new Error(`Failed to save operation snapshot: ${error.message}`);
  }
}
