import "server-only";

import type { TenantContext } from "@/context/storeContext";
import {
  getLatestPublication,
  getLatestProductDecision,
  getLatestPublishingPackage,
  getProductById,
  getProductHistory,
  getProductIntelligenceHistory,
  getProductLifecycleHistory,
  getRelatedProducts,
} from "@/services/repositories/productRepository";
import { getResponses } from "@/services/aiAudit/AIAuditRepository";
import { getProductEvidence } from "@/services/repositories/evidenceRepository";
import { getLatestProductExplanation } from "@/services/repositories/explanationRepository";
import { getLatestCostAnalysis } from "@/services/repositories/costRepository";
import { getLatestSupplierReliability } from "@/services/repositories/supplierReliabilityRepository";
import { getRuleEvaluationsForProduct } from "@/services/repositories/rulesRepository";
import {
  getMemoryForProduct,
  getProductMemoryEvents,
} from "@/services/repositories/productMemoryRepository";

export async function getProductWorkspace(
  tenantContext: TenantContext,
  productId: string
) {
  const product = await getProductById(tenantContext, productId);

  if (!product) return null;

  const memory = await getMemoryForProduct({
    tenantContext,
    product,
  });

  const [
    intelligenceHistory,
    publishingPackage,
    publication,
    decision,
    history,
    lifecycleHistory,
    relatedProducts,
    aiHistory,
    evidence,
    costAnalysis,
    supplierReliability,
    ruleEvaluations,
    explanation,
    memoryEvents,
  ] = await Promise.all([
    getProductIntelligenceHistory(tenantContext, productId),
    getLatestPublishingPackage(tenantContext, productId),
    getLatestPublication(tenantContext, productId),
    getLatestProductDecision(tenantContext, productId),
    getProductHistory(tenantContext, productId, product),
    getProductLifecycleHistory(tenantContext, productId),
    getRelatedProducts(tenantContext, product),
    getResponses({ tenantContext, productId, limit: 25 }),
    getProductEvidence(tenantContext, productId),
    getLatestCostAnalysis(tenantContext, productId),
    getLatestSupplierReliability(tenantContext, productId),
    getRuleEvaluationsForProduct({
      tenantContext,
      productId,
      limit: 20,
    }),
    getLatestProductExplanation(tenantContext, productId),
    memory
      ? getProductMemoryEvents({
          tenantContext,
          productKey: memory.productKey,
          limit: 30,
        })
      : Promise.resolve([]),
  ]);

  return {
    product: {
      ...product,
      decision: decision || product.decision,
      explanation: explanation || product.explanation,
      memory: memory || product.memory,
    },
    tenantContext,
    intelligence: intelligenceHistory[0] || null,
    intelligenceHistory,
    publishingPackage,
    publication,
    history,
    lifecycleHistory,
    relatedProducts,
    aiHistory,
    evidence,
    costAnalysis: costAnalysis || product.costAnalysis || null,
    supplierReliability:
      supplierReliability || product.supplierReliability || null,
    ruleEvaluations,
    explanation: explanation || product.explanation || null,
    memory: memory || null,
    memoryEvents,
  };
}

export type ProductWorkspace = NonNullable<
  Awaited<ReturnType<typeof getProductWorkspace>>
>;
