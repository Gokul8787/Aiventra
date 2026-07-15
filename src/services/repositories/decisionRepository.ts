import "server-only";

import { ProductDecisionResult } from "@/ai/decision/types";
import { Product } from "@/ai/types/product";
import type { TenantContext } from "@/context/storeContext";
import { tenantColumns } from "@/context/storeContext";
import { supabaseAdmin } from "@/services/supabase/admin";

import {
  getProductPersistenceKey,
  PersistedProduct,
} from "./productsRepository";

export type ProductDecisionRow = {
  product_id: string;
  decision: ProductDecisionResult["decision"];
  confidence: number | string;
  risk: ProductDecisionResult["risk"];
  automation_allowed: boolean;
  requires_human_approval: boolean;
  readiness?: ProductDecisionResult["readiness"] | null;
  readiness_blocking_reasons?: string[] | null;
  reasons: ProductDecisionResult["reasons"] | null;
  blockers: string[] | null;
  warnings: string[] | null;
  engine_version: string;
  evaluated_at: string;
};

export function mapProductDecisionRow(
  row: ProductDecisionRow
): ProductDecisionResult {
  return {
    decision: row.decision,
    confidence: Number(row.confidence),
    risk: row.risk,
    automationAllowed: row.automation_allowed,
    requiresHumanApproval: row.requires_human_approval,
    readiness: row.readiness || "NOT_READY",
    readinessBlockingReasons: row.readiness_blocking_reasons || [],
    reasons: row.reasons || [],
    blockers: row.blockers || [],
    warnings: row.warnings || [],
    engineVersion: row.engine_version,
    evaluatedAt: row.evaluated_at,
  };
}

export async function saveProductDecisions(input: {
  tenantContext: TenantContext;
  scanId: string;
  products: Product[];
  persistedProducts: Map<string, PersistedProduct>;
}): Promise<void> {
  const rows = input.products.flatMap((product) => {
    if (!product.decision) return [];

    const persistedProduct = input.persistedProducts.get(
      getProductPersistenceKey(product)
    );

    if (!persistedProduct) return [];

    return [
      {
        ...tenantColumns(input.tenantContext),
        scan_id: input.scanId,
        product_id: persistedProduct.id,
        decision: product.decision.decision,
        confidence: product.decision.confidence,
        risk: product.decision.risk,
        automation_allowed: product.decision.automationAllowed,
        requires_human_approval: product.decision.requiresHumanApproval,
        readiness: product.decision.readiness,
        readiness_blocking_reasons: product.decision.readinessBlockingReasons,
        reasons: product.decision.reasons,
        blockers: product.decision.blockers,
        warnings: product.decision.warnings,
        engine_version: product.decision.engineVersion,
        evaluated_at: product.decision.evaluatedAt,
      },
    ];
  });

  if (rows.length === 0) return;

  const { error } = await supabaseAdmin.from("product_decisions").upsert(rows, {
    onConflict: "scan_id,product_id",
  });

  if (error) {
    throw new Error(`Failed to save product decisions: ${error.message}`);
  }
}
