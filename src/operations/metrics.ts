import type {
  DashboardOrderItemMetricRow,
  DashboardOrderMetricRow,
  DashboardPlatformFulfilmentMetricRow,
  DashboardSupplierOrderMetricRow,
  OperationsJobRow,
} from "./dashboardRepository";
import type { OperationsMetricsSnapshot } from "./types";

function round(value: number, digits = 2) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function isWithinLastHours(timestamp: string, hours: number) {
  return new Date(timestamp).getTime() >= Date.now() - hours * 60 * 60 * 1000;
}

function rate(numerator: number, denominator: number) {
  if (!denominator) return 0;
  return round((numerator / denominator) * 100);
}

function averageDurationsMs(
  values: Array<{ startedAt?: string; completedAt?: string }>
) {
  const durations = values
    .filter((value) => value.startedAt && value.completedAt)
    .map(
      (value) =>
        new Date(value.completedAt as string).getTime() -
        new Date(value.startedAt as string).getTime()
    )
    .filter((value) => value >= 0);

  if (durations.length === 0) return 0;

  return Math.round(
    durations.reduce((sum, duration) => sum + duration, 0) / durations.length
  );
}

export function buildOperationsMetrics(input: {
  jobs: OperationsJobRow[];
  orders: DashboardOrderMetricRow[];
  orderItemsToday: DashboardOrderItemMetricRow[];
  supplierOrders: DashboardSupplierOrderMetricRow[];
  platformFulfilments: DashboardPlatformFulfilmentMetricRow[];
  averageAiLatencyMs: number;
  aiCostToday: number;
  averageSupplierLatencyMs: number;
  averageShopifyLatencyMs: number;
}): OperationsMetricsSnapshot {
  const ordersToday = input.orders.filter((order) =>
    isWithinLastHours(order.createdAt, 24)
  );
  const supplierOrdersRecent = input.supplierOrders.filter((order) =>
    isWithinLastHours(order.createdAt, 24 * 7)
  );
  const platformFulfilmentsRecent = input.platformFulfilments.filter(
    (fulfilment) => isWithinLastHours(fulfilment.createdAt, 24 * 7)
  );
  const completedJobsLastHour = input.jobs.filter(
    (job) =>
      job.completedAt &&
      isWithinLastHours(job.completedAt, 1) &&
      job.status === "completed"
  );
  const workerIdsLastHour = new Set(
    completedJobsLastHour.map((job) => job.workerId).filter(Boolean)
  );
  const completedRecoveries = input.orders.filter((order) =>
    order.status === "cancelled" || order.status === "refunded"
  );

  return {
    ordersToday: ordersToday.length,
    supplierSuccessRate: rate(
      supplierOrdersRecent.filter((order) =>
        ["PAID", "PROCESSING", "SHIPPED", "DELIVERED"].includes(order.status)
      ).length,
      supplierOrdersRecent.length
    ),
    fulfilmentSuccessRate: rate(
      platformFulfilmentsRecent.filter(
        (fulfilment) => fulfilment.status === "fulfilled"
      ).length,
      platformFulfilmentsRecent.length
    ),
    averageSupplierLatencyMs:
      input.averageSupplierLatencyMs ||
      averageDurationsMs(
        supplierOrdersRecent.map((order) => ({
          startedAt: order.createdAt,
          completedAt: order.submittedAt || order.updatedAt,
        }))
      ),
    averageShopifyLatencyMs:
      input.averageShopifyLatencyMs ||
      averageDurationsMs(
        platformFulfilmentsRecent.map((fulfilment) => ({
          startedAt: fulfilment.createdAt,
          completedAt: fulfilment.fulfilledAt || fulfilment.updatedAt,
        }))
      ),
    averageAiLatencyMs: input.averageAiLatencyMs,
    aiCostToday: round(input.aiCostToday, 6),
    revenueToday: round(
      ordersToday.reduce((sum, order) => sum + order.total, 0)
    ),
    profitEstimateToday: round(
      input.orderItemsToday.reduce((sum, item) => sum + item.profit, 0)
    ),
    queueThroughputPerHour: completedJobsLastHour.length,
    workerThroughputPerHour: workerIdsLastHour.size
      ? round(completedJobsLastHour.length / workerIdsLastHour.size)
      : 0,
    recoverySuccessRate: rate(
      completedRecoveries.length,
      input.orders.filter((order) =>
        ["cancelled", "refunded"].includes(order.status)
      ).length
    ),
    cancellationSuccessRate: rate(
      input.orders.filter((order) => order.status === "cancelled").length,
      input.orders.filter(
        (order) => order.cancelledAt || order.status === "cancelled"
      ).length
    ),
    refundRate: rate(
      input.orders.filter((order) => order.status === "refunded").length,
      input.orders.length
    ),
  };
}
