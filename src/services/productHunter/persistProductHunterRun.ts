import "server-only";

import { Product } from "@/ai/types/product";
import { SourceStatus } from "@/ai/agents/trendCollector";
import type { TenantContext } from "@/context/storeContext";
import { tenantPayload } from "@/context/storeContext";

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
import { saveProductDecisions } from "@/services/repositories/decisionRepository";
import { saveProductEvidence } from "@/services/repositories/evidenceRepository";
import {
  saveEvidenceRecords,
  saveProviderHealthFromEvidence,
} from "@/services/repositories/evidenceStoreRepository";
import { saveProductExplanations } from "@/services/repositories/explanationRepository";
import { saveProductCostSnapshots } from "@/services/repositories/costRepository";
import {
  saveSupplierReliability,
  saveSupplierSnapshots,
} from "@/services/repositories/supplierReliabilityRepository";
import { applyProductHunterLifecycle } from "@/lifecycle/ProductLifecycleService";
import type { ProductLifecycleStage } from "@/lifecycle/ProductLifecycle";
import { evaluateProductRules } from "@/services/rules/evaluateProductRules";
import { rememberProductMemory } from "@/services/repositories/productMemoryRepository";

export type PersistProductHunterRunInput = {
  tenantContext: TenantContext;
  jobId?: string;
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
    jobId =
      input.jobId ||
      (await createAIJob(input.tenantContext, "product_scan", {
        searchQuery: input.searchQuery || null,
        recommendationThreshold: input.recommendationThreshold,
        tenantContext: tenantPayload(input.tenantContext),
      }));

    scanId = await createProductScan({
      tenantContext: input.tenantContext,
      jobId,
      searchQuery: input.searchQuery,
      recommendationThreshold: input.recommendationThreshold,
    });

    await saveProviderRuns(input.tenantContext, scanId, input.sources);

    const persistedProducts = await upsertProducts(
      input.tenantContext,
      input.products
    );

    await saveProductEvidence({
      tenantContext: input.tenantContext,
      scanId,
      products: input.products,
      persistedProducts,
    });

    await saveEvidenceRecords({
      tenantContext: input.tenantContext,
      scanId,
      products: input.products,
      persistedProducts,
    });

    await saveProviderHealthFromEvidence({
      tenantContext: input.tenantContext,
      evidence: input.products.flatMap((product) => product.evidenceRecords || []),
    });

    await saveProductCostSnapshots({
      tenantContext: input.tenantContext,
      scanId,
      products: input.products,
      persistedProducts,
    });

    await saveSupplierSnapshots({
      tenantContext: input.tenantContext,
      scanId,
      products: input.products,
      persistedProducts,
    });

    await saveSupplierReliability({
      tenantContext: input.tenantContext,
      scanId,
      products: input.products,
      persistedProducts,
    });

    await saveProductIntelligence({
      tenantContext: input.tenantContext,
      scanId,
      products: input.products,
      persistedProducts,
    });

    await saveProductDecisions({
      tenantContext: input.tenantContext,
      scanId,
      products: input.products,
      persistedProducts,
    });

    await saveProductExplanations({
      tenantContext: input.tenantContext,
      scanId,
      products: input.products,
      persistedProducts,
    });

    await applyProductHunterLifecycle({
      tenantContext: input.tenantContext,
      products: input.products,
      persistedProducts,
    });

    const recommendedProductIds = new Set(
      input.recommendations.map((product) => product.id)
    );

    for (const product of input.products) {
      const persistedProduct = persistedProducts.get(
        getProductPersistenceKey(product)
      );

      if (!persistedProduct) continue;

      const lifecycleStage: ProductLifecycleStage =
        product.decision?.decision === "PUBLISH" ? "AI_APPROVED" : "ANALYSED";
      const memory = await rememberProductMemory({
        tenantContext: input.tenantContext,
        product: {
          ...product,
          databaseId: persistedProduct.id,
          currentLifecycle: lifecycleStage,
        },
        options: {
          productDatabaseId: persistedProduct.id,
          scanId,
          recommended: recommendedProductIds.has(product.id),
          retired: product.currentLifecycle === "RETIRED",
        },
      });
      const productWithMemory = {
        ...product,
        databaseId: persistedProduct.id,
        currentLifecycle: lifecycleStage,
        memory,
      };

      await evaluateProductRules({
        organisationId: input.tenantContext.organisationId,
        storeId: input.tenantContext.storeId,
        product: productWithMemory,
        productDatabaseId: persistedProduct.id,
        scanId,
        inventory: {
          currentStock: product.stock,
        },
        lifecycle: {
          stage: lifecycleStage,
          status: "ACTIVE",
        },
      });
    }

    await linkProductsToScan({
      tenantContext: input.tenantContext,
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
