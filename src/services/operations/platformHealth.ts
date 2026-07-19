import type { OperationsHealthChecks } from "@/operations/types";
import type {
  OperationsDashboardSnapshot,
  ProviderSnapshot,
} from "@/operations/types";

function providerHealthy(provider?: ProviderSnapshot) {
  return Boolean(
    provider &&
      provider.configured &&
      (provider.status === "healthy" || provider.status === "warning")
  );
}

export function buildPlatformHealthChecks(
  dashboard: OperationsDashboardSnapshot,
  databaseHealthy: boolean
): OperationsHealthChecks {
  const shopify = dashboard.providers.providers.find(
    (provider) => provider.id === "shopify"
  );
  const cj = dashboard.providers.providers.find(
    (provider) => provider.id === "cj"
  );

  const queues = Object.values(dashboard.queues).every(
    (queue) =>
      queue.oldestMessageAgeSeconds < 24 * 60 * 60 &&
      queue.staleJobs === 0 &&
      queue.counts.dead_letter < 10
  );
  const workers =
    dashboard.workers.summary.healthy > 0 ||
    dashboard.workers.summary.warning > 0;

  return {
    database: databaseHealthy,
    shopify: providerHealthy(shopify),
    cj: providerHealthy(cj),
    queues,
    workers,
  };
}
