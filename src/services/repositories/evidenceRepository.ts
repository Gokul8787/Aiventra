import "server-only";

import { ProductEvidence } from "@/ai/evidence/types";
import { Product } from "@/ai/types/product";
import type { TenantContext } from "@/context/storeContext";
import { tenantColumns } from "@/context/storeContext";
import { supabaseAdmin } from "@/services/supabase/admin";
import {
  getProductPersistenceKey,
  PersistedProduct,
} from "./productsRepository";

export type ProductEvidenceRecord = ProductEvidence & {
  id: string;
  createdAt: string;
};

type ProductEvidenceRow = {
  id: string;
  source: ProductEvidence["source"];
  metric: ProductEvidence["metric"];
  value: number | string | null;
  normalized_score: number | string | null;
  reliability: number | string;
  freshness: number | string;
  completeness: number | string;
  verified: boolean;
  metadata: Record<string, unknown> | null;
  observed_at: string;
  created_at: string;
};

function clampScore(value: number) {
  return Math.max(0, Math.min(100, Math.round(value * 100) / 100));
}

function mapEvidenceRow(row: ProductEvidenceRow): ProductEvidenceRecord {
  return {
    id: row.id,
    source: row.source,
    metric: row.metric,
    value: Number(row.value || 0),
    normalizedScore: Number(row.normalized_score || 0),
    reliability: Number(row.reliability || 0),
    freshness: Number(row.freshness || 0),
    completeness: Number(row.completeness || 0),
    verified: row.verified,
    metadata: row.metadata || {},
    observedAt: row.observed_at,
    createdAt: row.created_at,
  };
}

export async function saveProductEvidence(input: {
  tenantContext: TenantContext;
  scanId: string;
  products: Product[];
  persistedProducts: Map<string, PersistedProduct>;
}): Promise<void> {
  const rows = input.products.flatMap((product) => {
    const persistedProduct = input.persistedProducts.get(
      getProductPersistenceKey(product)
    );

    if (!persistedProduct || !product.evidence?.length) return [];

    return product.evidence.map((evidence) => ({
      ...tenantColumns(input.tenantContext),
      scan_id: input.scanId,
      product_id: persistedProduct.id,
      source: evidence.source,
      metric: evidence.metric,
      value: evidence.value,
      normalized_score: clampScore(evidence.normalizedScore),
      reliability: clampScore(evidence.reliability),
      freshness: clampScore(evidence.freshness),
      completeness: clampScore(evidence.completeness),
      verified: evidence.verified,
      metadata: evidence.metadata || {},
      observed_at: evidence.observedAt,
    }));
  });

  if (rows.length === 0) return;

  const productIds = Array.from(
    new Set(rows.map((row) => row.product_id))
  );

  const { error: deleteError } = await supabaseAdmin
    .from("product_evidence")
    .delete()
    .eq("organisation_id", input.tenantContext.organisationId)
    .eq("store_id", input.tenantContext.storeId)
    .eq("scan_id", input.scanId)
    .in("product_id", productIds);

  if (deleteError) {
    throw new Error(
      `Failed to clear product evidence: ${deleteError.message}`
    );
  }

  const { error } = await supabaseAdmin.from("product_evidence").insert(rows);

  if (error) {
    throw new Error(`Failed to save product evidence: ${error.message}`);
  }
}

export async function getProductEvidence(
  tenantContext: TenantContext,
  productId: string,
  limit = 50
): Promise<ProductEvidenceRecord[]> {
  const { data, error } = await supabaseAdmin
    .from("product_evidence")
    .select(
      "id, source, metric, value, normalized_score, reliability, freshness, completeness, verified, metadata, observed_at, created_at"
    )
    .eq("organisation_id", tenantContext.organisationId)
    .eq("store_id", tenantContext.storeId)
    .eq("product_id", productId)
    .order("observed_at", { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(`Failed to load product evidence: ${error.message}`);
  }

  return ((data || []) as ProductEvidenceRow[]).map(mapEvidenceRow);
}
