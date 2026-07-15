import "server-only";

import type { Product } from "@/ai/types/product";
import type { TenantContext } from "@/context/storeContext";
import { tenantColumns } from "@/context/storeContext";
import type { Evidence, ProviderHealth } from "@/evidence/types";
import { supabaseAdmin } from "@/services/supabase/admin";
import { getProductMemoryKey } from "@/ai/memory/memoryEngine";
import {
  getProductPersistenceKey,
  PersistedProduct,
} from "./productsRepository";

function toJson(value: unknown) {
  return JSON.parse(JSON.stringify(value ?? null));
}

function mapHealth(row: {
  provider: string;
  category: string;
  status: ProviderHealth["status"];
  last_success_at: string | null;
  last_failure_at: string | null;
  latency_ms: number | string;
  cost: number | string;
  quota_remaining: number | string | null;
  version: string;
  checked_at: string;
}): ProviderHealth {
  return {
    provider: row.provider,
    category: row.category,
    status: row.status,
    lastSuccessAt: row.last_success_at || undefined,
    lastFailureAt: row.last_failure_at || undefined,
    latencyMs: Number(row.latency_ms || 0),
    cost: Number(row.cost || 0),
    quotaRemaining:
      row.quota_remaining == null ? undefined : Number(row.quota_remaining),
    version: row.version,
    checkedAt: row.checked_at,
  };
}

export async function saveEvidenceRecords(input: {
  tenantContext: TenantContext;
  scanId?: string;
  products: Product[];
  persistedProducts: Map<string, PersistedProduct>;
}): Promise<void> {
  const rows = input.products.flatMap((product) => {
    if (!product.evidenceRecords?.length) return [];

    const persistedProduct = input.persistedProducts.get(
      getProductPersistenceKey(product)
    );

    return product.evidenceRecords.map((evidence) => ({
      ...tenantColumns(input.tenantContext),
      product_id: persistedProduct?.id || product.databaseId || null,
      scan_id: input.scanId || null,
      product_key: getProductMemoryKey(product),
      provider: evidence.provider,
      category: evidence.category,
      verified: evidence.verified,
      confidence: evidence.confidence,
      quality: evidence.quality,
      retrieved_at: evidence.retrievedAt,
      expires_at: evidence.expiresAt || null,
      cost: evidence.cost,
      latency_ms: Math.round(evidence.latency),
      data: toJson(evidence.data),
    }));
  });

  if (rows.length === 0) return;

  const { error } = await supabaseAdmin.from("evidence_records").insert(rows);

  if (error) {
    throw new Error(`Failed to save evidence records: ${error.message}`);
  }
}

export async function saveProviderHealthFromEvidence(input: {
  tenantContext: TenantContext;
  evidence: Evidence[];
}): Promise<void> {
  if (input.evidence.length === 0) return;

  const now = new Date().toISOString();
  const latestEvidenceByProviderCategory = new Map<string, Evidence>();

  for (const evidence of input.evidence) {
    const key = `${evidence.provider}:${evidence.category}`;
    const existing = latestEvidenceByProviderCategory.get(key);

    if (
      !existing ||
      new Date(evidence.retrievedAt).getTime() >
        new Date(existing.retrievedAt).getTime()
    ) {
      latestEvidenceByProviderCategory.set(key, evidence);
    }
  }

  const rows = Array.from(latestEvidenceByProviderCategory.values()).map((evidence) => ({
    ...tenantColumns(input.tenantContext),
    provider: evidence.provider,
    category: evidence.category,
    status: evidence.verified ? "healthy" : "degraded",
    last_success_at: evidence.quality > 0 ? evidence.retrievedAt : null,
    last_failure_at: evidence.quality <= 0 ? evidence.retrievedAt : null,
    latency_ms: Math.round(evidence.latency),
    cost: evidence.cost,
    quota_remaining: null,
    version:
      typeof evidence.data === "object" &&
      evidence.data !== null &&
      "version" in evidence.data
        ? String((evidence.data as { version?: unknown }).version || "1.0.0")
        : "1.0.0",
    metadata: toJson({
      evidenceId: evidence.id,
      verified: evidence.verified,
      quality: evidence.quality,
      confidence: evidence.confidence,
    }),
    checked_at: now,
    updated_at: now,
  }));

  const { error } = await supabaseAdmin.from("provider_health").upsert(rows, {
    onConflict: "organisation_id,store_id,provider,category",
  });

  if (error) {
    throw new Error(`Failed to save provider health: ${error.message}`);
  }
}

export async function getEvidenceProviderHealth(
  tenantContext: TenantContext
): Promise<ProviderHealth[]> {
  const { data, error } = await supabaseAdmin
    .from("provider_health")
    .select(
      "provider, category, status, last_success_at, last_failure_at, latency_ms, cost, quota_remaining, version, checked_at"
    )
    .eq("organisation_id", tenantContext.organisationId)
    .eq("store_id", tenantContext.storeId)
    .order("checked_at", { ascending: false });

  if (error) {
    throw new Error(`Failed to load provider health: ${error.message}`);
  }

  return ((data || []) as Parameters<typeof mapHealth>[0][]).map(mapHealth);
}
