import "server-only";

import { Product } from "@/ai/types/product";
import { SourceStatus } from "@/ai/agents/trendCollector";

import {
  completeAIJob,
  createAIJob,
  failAIJob,
} from "@/services/repositories/aiJobRepository";

import {
  completeProductScan,
  createProductScan,
  failProductScan,
} from "@/services/repositories/productScanRepository";

import { saveProviderRuns } from "@/services/repositories/providerRunRepository";

import {
  getProductPersistenceKey,
  upsertProducts,
} from "@/services/repositories/productsRepository";

import { saveProductIntelligence } from "@/services/repositories/intelligenceRepository";

import { linkProductsToScan } from "@/services/repositories/scanProductRepository";

export type PersistProductHunterRunInput = {
  products: Product[];
  recommendations: Product[];
  sources: SourceStatus[];
  recommendationThreshold: number;
  searchQuery?: string;
};

export type PersistProductHunterRunResult = {
  jobId: string;
  scanId: string;
  productDatabaseIds: Record<string, string>;
};

export async function persistProductHunterRun(
  input: PersistProductHunterRunInput
): Promise<PersistProductHunterRunResult> {
  let jobId: string | null = null;
  let scanId: string | null = null;

  try {
    jobId = await createAIJob("product_scan", {
      searchQuery: input.searchQuery || null,
      recommendationThreshold: input.recommendationThreshold,
    });

    scanId = await createProductScan({
      jobId,
      searchQuery: input.searchQuery,
      recommendationThreshold: input.recommendationThreshold,
    });

    await saveProviderRuns(scanId, input.sources);

    const persistedProducts = await upsertProducts(input.products);

    await saveProductIntelligence({
      scanId,
      products: input.products,
      persistedProducts,
    });

    const recommendedProductIds = new Set(
      input.recommendations.map((product) => product.id)
    );

    await linkProductsToScan({
      scanId,
      products: input.products,
      recommendedProductIds,
      persistedProducts,
    });

    await completeProductScan(scanId, {
      totalFound: input.products.length,
      totalRecommended: input.recommendations.length,
    });

    await completeAIJob(jobId, {
      scanId,
      totalFound: input.products.length,
      totalRecommended: input.recommendations.length,
    });

    const productDatabaseIds = Object.fromEntries(
      input.products.flatMap((product) => {
        const persistedProduct = persistedProducts.get(
          getProductPersistenceKey(product)
        );

        return persistedProduct
          ? [[getProductPersistenceKey(product), persistedProduct.id]]
          : [];
      })
    );

    return {
      jobId,
      scanId,
      productDatabaseIds,
    };
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Product Hunter persistence failed.";

    if (scanId) {
      await failProductScan(scanId, message);
    }

    if (jobId) {
      await failAIJob(jobId, message);
    }

    throw error;
  }
}
