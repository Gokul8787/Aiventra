import type { ProviderHealth } from "@/evidence/types";
import type { JobStatus } from "@/jobs/status";
import type { JobQueueName } from "@/jobs/types";
import type { OperationsAlertSeverity } from "@/recovery/types";

export type OperationsQueueKey =
  | "jobs"
  | "cj"
  | "shopify"
  | "deadLetter";

export type OperationsQueueSnapshot = {
  key: OperationsQueueKey;
  label: string;
  queueName: JobQueueName;
  counts: Record<JobStatus, number>;
  active: number;
  oldestMessageAgeSeconds: number;
  messagesPerHour: number;
  failuresPerHour: number;
  averageProcessingTimeMs: number;
  staleJobs: number;
  updatedAt: string;
};

export type WorkerStatus = "healthy" | "warning" | "offline";

export type WorkerSnapshot = {
  workerKey: string;
  workerId: string;
  queueName: string;
  version: string;
  host?: string;
  status: WorkerStatus;
  memoryMb?: number;
  cpuPercent?: number;
  heartbeatAt: string;
  metadata: Record<string, unknown>;
};

export type ProviderSnapshot = {
  id: string;
  name: string;
  configured: boolean;
  status: "healthy" | "warning" | "critical" | "missing" | "unknown";
  latencyMs: number;
  failures: number;
  availability: number;
  quotaRemaining?: number;
  rateLimitRemaining?: number;
  apiPointsRemaining?: number;
  lastSuccessAt?: string;
  lastFailureAt?: string;
  lastCheckedAt?: string;
  message?: string;
  categories: string[];
  metadata?: Record<string, unknown>;
};

export type OperationsAlertSnapshot = {
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

export type DeadLetterSnapshot = {
  id: string;
  sourceQueue: string;
  jobType: string;
  status: "open" | "requeued" | "resolved" | "ignored";
  errorCode?: string;
  errorMessage?: string;
  attemptCount: number;
  maxAttempts: number;
  createdAt: string;
  jobId?: string;
  cancellationRequestId?: string;
  payload: Record<string, unknown>;
};

export type RecoverySnapshot = {
  id: string;
  orderId: string;
  status: string;
  decision?: string;
  confidence?: number;
  requestedAt: string;
  completedAt?: string;
  nextRetryAt?: string;
};

export type OperationsMetricsSnapshot = {
  ordersToday: number;
  supplierSuccessRate: number;
  fulfilmentSuccessRate: number;
  averageSupplierLatencyMs: number;
  averageShopifyLatencyMs: number;
  averageAiLatencyMs: number;
  aiCostToday: number;
  revenueToday: number;
  profitEstimateToday: number;
  queueThroughputPerHour: number;
  workerThroughputPerHour: number;
  recoverySuccessRate: number;
  cancellationSuccessRate: number;
  refundRate: number;
};

export type OperationsHealthChecks = {
  database: boolean;
  shopify: boolean;
  cj: boolean;
  queues: boolean;
  workers: boolean;
};

export type OperationsDashboardSnapshot = {
  queues: Record<OperationsQueueKey, OperationsQueueSnapshot>;
  workers: {
    summary: Record<WorkerStatus, number>;
    recent: WorkerSnapshot[];
  };
  providers: {
    summary: Record<ProviderSnapshot["status"], number>;
    providers: ProviderSnapshot[];
  };
  alerts: {
    summary: Record<OperationsAlertSeverity, number>;
    open: number;
    recent: OperationsAlertSnapshot[];
  };
  deadLetters: {
    open: number;
    retrying: number;
    resolved: number;
    ignored: number;
    items: DeadLetterSnapshot[];
  };
  recovery: {
    pending: number;
    checking: number;
    retrying: number;
    manualReview: number;
    completed: number;
    tooLate: number;
    recent: RecoverySnapshot[];
  };
  metrics: OperationsMetricsSnapshot;
  generatedAt: string;
};

export type OperationsHealthReport = {
  healthy: boolean;
  checks: OperationsHealthChecks;
  checkedAt: string;
};

export type ProviderHealthRow = ProviderHealth & {
  availability?: number;
  errorRate?: number;
  rateLimitRemaining?: number;
  apiPointsRemaining?: number;
  statusMessage?: string;
  metadata?: Record<string, unknown>;
};
