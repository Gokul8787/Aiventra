import "server-only";

import type { TenantContext } from "@/context/storeContext";
import { tenantPayload } from "@/context/storeContext";
import { publishEvent } from "@/services/events/eventRepository";
import { runProductHunterScan } from "@/services/productHunter/runProductHunterScan";
import {
  appendJobLog,
  updateJobProgress,
} from "@/services/repositories/backgroundJobRepository";

export async function handleProductScanJob(input: {
  tenantContext: TenantContext;
  jobId: string;
  searchQuery: string;
  generateInsights?: boolean;
}) {
  await appendJobLog({
    tenantContext: input.tenantContext,
    jobId: input.jobId,
    level: "info",
    message: "Product scan job started.",
    context: {
      searchQuery: input.searchQuery,
      tenantContext: tenantPayload(input.tenantContext),
    },
  });

  const result = await runProductHunterScan({
    tenantContext: input.tenantContext,
    jobId: input.jobId,
    searchQuery: input.searchQuery,
    generateInsights: input.generateInsights,
    onProgress: async (progress, currentStep) => {
      await updateJobProgress({
        jobId: input.jobId,
        progress,
        currentStep,
      });

      await appendJobLog({
        tenantContext: input.tenantContext,
        jobId: input.jobId,
        level: "info",
        message: currentStep,
        context: {
          progress,
        },
      });
    },
  });

  await publishEvent({
    tenantContext: input.tenantContext,
    eventType: "ProductScanned",
    aggregateType: "product_scan",
    aggregateId: result.persistence.scanId,
    payload: {
      jobId: result.persistence.jobId,
      scanId: result.persistence.scanId,
      totalProducts: result.totalProducts,
      recommendedProducts: result.recommendedProducts,
    },
  });

  return {
    scanId: result.persistence.scanId,
    totalProducts: result.totalProducts,
    recommendedProducts: result.recommendedProducts,
  };
}
