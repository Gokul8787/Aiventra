import "server-only";

import type { ExplainableDecision } from "@/ai/explainability/types";
import type { Product } from "@/ai/types/product";
import type { TenantContext } from "@/context/storeContext";
import { tenantColumns } from "@/context/storeContext";
import { supabaseAdmin } from "@/services/supabase/admin";
import {
  getProductPersistenceKey,
  PersistedProduct,
} from "./productsRepository";

type ExplanationRow = {
  decision: string;
  final_score: number | string;
  confidence: number | string;
  summary: string;
  items: ExplainableDecision["items"] | null;
  explanation: Partial<ExplainableDecision> | null;
  version: string;
  generated_at: string;
};

function toJson(value: unknown) {
  return JSON.parse(JSON.stringify(value ?? null));
}

function mapExplanation(row: ExplanationRow): ExplainableDecision {
  return {
    finalScore: Number(row.final_score || 0),
    confidence: Number(row.confidence || 0),
    decision: row.decision,
    summary: row.summary,
    items: row.items || [],
    generatedAt: row.generated_at,
    version: row.version,
    ...row.explanation,
  };
}

export async function saveProductExplanations(input: {
  tenantContext: TenantContext;
  scanId: string;
  products: Product[];
  persistedProducts: Map<string, PersistedProduct>;
}): Promise<void> {
  const rows = input.products.flatMap((product) => {
    if (!product.explanation) return [];

    const persistedProduct = input.persistedProducts.get(
      getProductPersistenceKey(product)
    );

    if (!persistedProduct) return [];

    return [
      {
        ...tenantColumns(input.tenantContext),
        scan_id: input.scanId,
        product_id: persistedProduct.id,
        decision: product.explanation.decision,
        final_score: product.explanation.finalScore,
        confidence: product.explanation.confidence,
        summary: product.explanation.summary,
        items: toJson(product.explanation.items),
        explanation: toJson(product.explanation),
        version: product.explanation.version,
        generated_at: product.explanation.generatedAt,
      },
    ];
  });

  if (rows.length === 0) return;

  const { error } = await supabaseAdmin.from("ai_explanations").upsert(rows, {
    onConflict: "scan_id,product_id",
  });

  if (error) {
    throw new Error(`Failed to save AI explanations: ${error.message}`);
  }
}

export async function getLatestProductExplanation(
  tenantContext: TenantContext,
  productId: string
): Promise<ExplainableDecision | null> {
  const { data, error } = await supabaseAdmin
    .from("ai_explanations")
    .select(
      "decision, final_score, confidence, summary, items, explanation, version, generated_at"
    )
    .eq("organisation_id", tenantContext.organisationId)
    .eq("store_id", tenantContext.storeId)
    .eq("product_id", productId)
    .order("generated_at", { ascending: false })
    .limit(1)
    .maybeSingle<ExplanationRow>();

  if (error) {
    throw new Error(`Failed to load AI explanation: ${error.message}`);
  }

  return data ? mapExplanation(data) : null;
}
