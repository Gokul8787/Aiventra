import "server-only";

import { addReasoning } from "@/ai/agents/reasoningEngine";
import {
  getTopRecommendations,
  RECOMMENDATION_THRESHOLD,
} from "@/ai/agents/recommendationEngine";
import { collectTrendingProducts } from "@/ai/agents/trendCollector";
import { generateProductInsight } from "@/ai/agents/productInsightAgent";
import type { TenantContext } from "@/context/storeContext";
import { requireTenantContext } from "@/context/storeContext";
import { analyseProduct } from "@/services/productAnalysis/analyseProduct";
import type { ProductScanRequest } from "@/services/productDiscovery/productScanRequest";
import {
  getProductScanSearchLabel,
  parseProductScanRequest,
} from "@/services/productDiscovery/productScanRequest";
import { getProductPersistenceKey } from "@/services/repositories/productsRepository";
import {
  persistProductHunterRun,
  PersistProductHunterRunResult,
} from "./persistProductHunterRun";

export async function runProductHunterScan(input?: {
  tenantContext?: TenantContext;
  jobId?: string;
  request?: ProductScanRequest;
  searchQuery?: string;
  generateInsights?: boolean;
  onProgress?: (progress: number, currentStep: string) => Promise<void>;
}): Promise<{
  persistence: PersistProductHunterRunResult;
  totalProducts: number;
  recommendedProducts: number;
  sources: Awaited<ReturnType<typeof collectTrendingProducts>>["sources"];
  products: Awaited<ReturnType<typeof collectTrendingProducts>>["products"];
  recommendations: Awaited<ReturnType<typeof collectTrendingProducts>>["products"];
}> {
  const tenantContext = requireTenantContext(input?.tenantContext);
  const request = parseProductScanRequest(
    input?.request || {
      mode: input?.searchQuery ? "keyword" : "broad",
      keyword: input?.searchQuery,
    }
  );
  const searchQuery = input?.searchQuery || getProductScanSearchLabel(request);
  await input?.onProgress?.(5, "Starting");

  await input?.onProgress?.(15, "Collecting providers");
  const { products, sources } = await collectTrendingProducts(request);
  const tenantProducts = products.map((product) => ({
    ...product,
    organisationId: tenantContext.organisationId,
    storeId: tenantContext.storeId,
    currency: product.currency || tenantContext.currency,
  }));

  await input?.onProgress?.(35, "Normalising products");
  const productsWithReasoning = addReasoning(tenantProducts);

  await input?.onProgress?.(55, "Calculating intelligence");
  const intelligentProducts = await Promise.all(
    productsWithReasoning.map((product) =>
      analyseProduct(tenantContext, product)
    )
  );

  await input?.onProgress?.(70, "Evaluating decisions");
  const baseRecommendations = getTopRecommendations(intelligentProducts);
  const recommendations =
    input?.generateInsights === false
      ? baseRecommendations
      : await Promise.all(
          baseRecommendations.map(async (product) => ({
            ...product,
            reason: await generateProductInsight(product, {
              tenantContext,
              jobId: input?.jobId,
            }),
          }))
        );

  await input?.onProgress?.(85, "Saving results");
  const persistence = await persistProductHunterRun({
    tenantContext,
    jobId: input?.jobId,
    products: intelligentProducts,
    recommendations,
    sources,
    recommendationThreshold: RECOMMENDATION_THRESHOLD,
    searchQuery,
  });

  const persistedRecommendations = recommendations.map((product) => ({
    ...product,
    databaseId:
      persistence.productDatabaseIds[getProductPersistenceKey(product)],
  }));

  return {
    persistence,
    totalProducts: intelligentProducts.length,
    recommendedProducts: recommendations.length,
    sources,
    products: intelligentProducts,
    recommendations: persistedRecommendations,
  };
}
