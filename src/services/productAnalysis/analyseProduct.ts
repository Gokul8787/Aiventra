import "server-only";

import type { Product } from "@/ai/types/product";
import type { TenantContext } from "@/context/storeContext";
import { calculateProductCost } from "@/ai/cost/calculateProductCost";
import { evaluateProductDecision } from "@/ai/decision/decisionEngine";
import { generateExplanation } from "@/ai/explainability/explanationEngine";
import { analyzeProductIntelligence } from "@/ai/intelligence/productIntelligenceEngine";
import "@/evidence/providers/registerDefaultEvidenceProviders";
import { collectEvidence } from "@/evidence/EvidenceEngine";
import { getMemoryForProduct } from "@/services/repositories/productMemoryRepository";
import { enrichProductWithSupplierReliability } from "@/services/suppliers/analyseSupplierReliability";

export async function analyseProduct(
  tenantContext: TenantContext,
  product: Product
): Promise<Product> {
  const { product: productWithEvidence } = await collectEvidence({
    tenantContext,
    product,
  });
  const productWithCost = {
    ...productWithEvidence,
    organisationId: tenantContext.organisationId,
    storeId: tenantContext.storeId,
    currency: productWithEvidence.currency || tenantContext.currency,
    costAnalysis: calculateProductCost(productWithEvidence),
  };

  const productWithSupplier = await enrichProductWithSupplierReliability(
    tenantContext,
    productWithCost
  );
  const memory = await getMemoryForProduct({
    tenantContext,
    product: productWithSupplier,
  });

  const productWithMemory = {
    ...productWithSupplier,
    memory: memory || undefined,
  };

  const intelligence = await analyzeProductIntelligence(productWithMemory);

  const enrichedProduct = {
    ...productWithMemory,
    aiScore: intelligence.overallScore,
    intelligence,
  };

  const decision = evaluateProductDecision({
    product: enrichedProduct,
    intelligence,
  });

  const productWithDecision = {
    ...enrichedProduct,
    decision,
  };
  const explanation = generateExplanation(productWithDecision);

  return {
    ...productWithDecision,
    explanation,
  };
}
