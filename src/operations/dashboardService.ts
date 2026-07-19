import "server-only";

import type { TenantContext } from "@/context/storeContext";
import { getAverageLatency, getCostByDay } from "@/services/aiAudit/AIAuditRepository";
import { buildAlertsSummary, buildDeadLetterSummary, buildRecoverySummary } from "@/services/operations/alertAggregator";
import { buildPlatformHealthChecks } from "@/services/operations/platformHealth";
import { buildProviderHealth } from "@/services/operations/providerHealth";
import { buildQueueHealth } from "@/services/operations/queueHealth";
import { buildWorkerHealth } from "@/services/operations/workerHealth";
import { testSupabaseConnection } from "@/services/supabase/health";
import {
  loadDashboardRawData,
  saveOperationSnapshot,
  saveQueueMetrics,
  saveSystemMetrics,
} from "./dashboardRepository";
import { buildOperationsMetrics } from "./metrics";
import type {
  OperationsDashboardSnapshot,
  OperationsHealthReport,
} from "./types";

export async function getOperationsDashboard(
  tenantContext: TenantContext
): Promise<OperationsDashboardSnapshot> {
  const generatedAt = new Date().toISOString();
  const [raw, averageAiLatencyMs, aiCostByDay] = await Promise.all([
    loadDashboardRawData(tenantContext),
    getAverageLatency(tenantContext, 7),
    getCostByDay(tenantContext, 1),
  ]);

  const queues = buildQueueHealth(raw.jobs, generatedAt);
  const workers = buildWorkerHealth(raw.workerHeartbeats);
  const providers = buildProviderHealth(raw.providerHealth);
  const alerts = buildAlertsSummary(raw.alerts);
  const deadLetters = buildDeadLetterSummary(raw.deadLetters);
  const recovery = buildRecoverySummary(raw.recovery);
  const metrics = buildOperationsMetrics({
    jobs: raw.jobs,
    orders: raw.orders,
    orderItemsToday: raw.orderItemsToday,
    supplierOrders: raw.supplierOrders,
    platformFulfilments: raw.platformFulfilments,
    averageAiLatencyMs,
    aiCostToday: aiCostByDay.reduce((sum, item) => sum + item.cost, 0),
    averageSupplierLatencyMs: providers.providers.find(
      (provider) => provider.id === "cj"
    )?.latencyMs || 0,
    averageShopifyLatencyMs: providers.providers.find(
      (provider) => provider.id === "shopify"
    )?.latencyMs || 0,
  });

  const snapshot: OperationsDashboardSnapshot = {
    queues,
    workers,
    providers,
    alerts,
    deadLetters,
    recovery,
    metrics,
    generatedAt,
  };

  await Promise.allSettled([
    saveQueueMetrics({
      tenantContext,
      rows: Object.values(snapshot.queues).map((queue) => ({
        queueName: queue.queueName,
        queued: queue.counts.queued,
        running: queue.counts.running,
        retrying: queue.counts.retrying,
        completed: queue.counts.completed,
        failed: queue.counts.failed,
        cancelled: queue.counts.cancelled,
        deadLetter: queue.counts.dead_letter,
        oldestMessageAgeSeconds: queue.oldestMessageAgeSeconds,
        messagesPerHour: queue.messagesPerHour,
        failuresPerHour: queue.failuresPerHour,
        averageProcessingTimeMs: queue.averageProcessingTimeMs,
        staleJobs: queue.staleJobs,
      })),
    }),
    saveSystemMetrics({
      tenantContext,
      rows: [
        {
          key: "orders_today",
          value: snapshot.metrics.ordersToday,
          unit: "count",
        },
        {
          key: "revenue_today",
          value: snapshot.metrics.revenueToday,
          unit: tenantContext.currency,
        },
        {
          key: "profit_estimate_today",
          value: snapshot.metrics.profitEstimateToday,
          unit: tenantContext.currency,
        },
        {
          key: "ai_cost_today",
          value: snapshot.metrics.aiCostToday,
          unit: "usd",
        },
      ],
    }),
    saveOperationSnapshot({
      tenantContext,
      snapshotKey: "operations",
      payload: snapshot as unknown as Record<string, unknown>,
    }),
  ]);

  return snapshot;
}

export async function getOperationsHealthReport(
  tenantContext: TenantContext
): Promise<OperationsHealthReport> {
  const [databaseHealth, dashboard] = await Promise.all([
    testSupabaseConnection(),
    getOperationsDashboard(tenantContext),
  ]);
  const checks = buildPlatformHealthChecks(
    dashboard,
    databaseHealth.connected && databaseHealth.storesTableAccessible
  );

  return {
    healthy: Object.values(checks).every(Boolean),
    checks,
    checkedAt: new Date().toISOString(),
  };
}
