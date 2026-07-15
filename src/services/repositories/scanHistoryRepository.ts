import "server-only";
import { supabaseAdmin } from "@/services/supabase/admin";
import { Product } from "@/ai/types/product";
import type { TenantContext } from "@/context/storeContext";
import {
  mapProductDecisionRow,
  ProductDecisionRow,
} from "./decisionRepository";
import { getCostAnalysisByScanProduct } from "./costRepository";
import { getSupplierReliabilityByScanProduct } from "./supplierReliabilityRepository";
import {
  getMemoryForProduct,
  getProductMemoryDashboard,
} from "./productMemoryRepository";
import { getEvidenceProviderHealth } from "./evidenceStoreRepository";

export type RecentScan = {
  id: string;
  status: "running" | "completed" | "failed";
  totalFound: number;
  totalRecommended: number;
  startedAt: string;
  completedAt?: string;
  providers: Array<{
    name: string;
    status: "success" | "failed" | "skipped";
    count: number;
    error?: string;
  }>;
};

type ProductRow = {
  id: string;
  raw_data: Product;
  current_lifecycle?: Product["currentLifecycle"] | null;
  lifecycle_status?: Product["lifecycleStatus"] | null;
  lifecycle_changed_at?: string | null;
};

type IntelligenceRow = {
  product_id: string;
  analysis: Product["intelligence"];
  overall_score: number | null;
};

type ScanProductRow = {
  product_id: string;
  recommended: boolean;
  rank: number | null;
};

type ProviderRunRow = {
  provider_name: string;
  status: "success" | "failed" | "skipped";
  products_found: number;
  error_message: string | null;
};

function mapProviderRun(provider: ProviderRunRow) {
  return {
    name: provider.provider_name,
    status: provider.status,
    count: provider.products_found,
    error: provider.error_message || undefined,
  };
}

export async function getRecentScans(
  tenantContext: TenantContext,
  limit = 10
): Promise<RecentScan[]> {
  const { data: scans, error: scansError } = await supabaseAdmin
    .from("product_scans")
    .select(
      `
        id,
        status,
        total_found,
        total_recommended,
        started_at,
        completed_at,
        provider_runs (
          provider_name,
          status,
          products_found,
          error_message
        )
      `
    )
    .eq("organisation_id", tenantContext.organisationId)
    .eq("store_id", tenantContext.storeId)
    .order("started_at", { ascending: false })
    .limit(limit);

  if (scansError) {
    throw new Error(`Failed to load recent scans: ${scansError.message}`);
  }

  return (scans || []).map((scan) => ({
    id: scan.id,
    status: scan.status,
    totalFound: scan.total_found,
    totalRecommended: scan.total_recommended,
    startedAt: scan.started_at,
    completedAt: scan.completed_at || undefined,
    providers: ((scan.provider_runs || []) as ProviderRunRow[]).map(
      mapProviderRun
    ),
  }));
}

export async function getLatestSavedRecommendations(
  tenantContext: TenantContext
): Promise<{
  tenantContext: TenantContext;
  scanId: string | null;
  totalProducts: number;
  recommendedProducts: number;
  products: Product[];
  sources: RecentScan["providers"];
  memoryDashboard: Awaited<ReturnType<typeof getProductMemoryDashboard>>;
  providerHealth: Awaited<ReturnType<typeof getEvidenceProviderHealth>>;
}> {
  const emptyMemoryDashboard = {
    mostSeen: [],
    mostPublished: [],
    highestConfidence: [],
    fastestGrowing: [],
  };
  const { data: scan, error: scanError } = await supabaseAdmin
    .from("product_scans")
    .select("id, total_found, total_recommended")
    .eq("organisation_id", tenantContext.organisationId)
    .eq("store_id", tenantContext.storeId)
    .eq("status", "completed")
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (scanError) {
    throw new Error(`Failed to load latest scan: ${scanError.message}`);
  }

  if (!scan) {
    return {
      tenantContext,
      scanId: null,
      totalProducts: 0,
      recommendedProducts: 0,
      products: [],
      sources: [],
      memoryDashboard: emptyMemoryDashboard,
      providerHealth: [],
    };
  }

  const [
    { data: scanProducts, error: scanProductsError },
    { data: providers, error: providersError },
  ] = await Promise.all([
    supabaseAdmin
      .from("scan_products")
      .select("product_id, recommended, rank")
      .eq("organisation_id", tenantContext.organisationId)
      .eq("store_id", tenantContext.storeId)
      .eq("scan_id", scan.id)
      .eq("recommended", true)
      .order("rank", { ascending: true }),
    supabaseAdmin
      .from("provider_runs")
      .select("provider_name, status, products_found, error_message")
      .eq("organisation_id", tenantContext.organisationId)
      .eq("store_id", tenantContext.storeId)
      .eq("scan_id", scan.id),
  ]);

  if (scanProductsError) {
    throw new Error(
      `Failed to load scan products: ${scanProductsError.message}`
    );
  }

  if (providersError) {
    throw new Error(`Failed to load provider runs: ${providersError.message}`);
  }

  const orderedProductIds = ((scanProducts || []) as ScanProductRow[]).map(
    (row) => row.product_id
  );

  const sources = ((providers || []) as ProviderRunRow[]).map(mapProviderRun);

  if (orderedProductIds.length === 0) {
    return {
      tenantContext,
      scanId: scan.id,
      totalProducts: scan.total_found,
      recommendedProducts: scan.total_recommended,
      products: [],
      sources,
      memoryDashboard: await getProductMemoryDashboard(tenantContext),
      providerHealth: await getEvidenceProviderHealth(tenantContext),
    };
  }

  const [
    { data: productRows, error: productsError },
    { data: intelligenceRows, error: intelligenceError },
    { data: decisionRows, error: decisionsError },
    costByProduct,
    supplierByProduct,
  ] = await Promise.all([
    supabaseAdmin
      .from("products")
      .select("id, raw_data, current_lifecycle, lifecycle_status, lifecycle_changed_at")
      .eq("organisation_id", tenantContext.organisationId)
      .eq("store_id", tenantContext.storeId)
      .in("id", orderedProductIds),
    supabaseAdmin
      .from("product_intelligence")
      .select("product_id, analysis, overall_score")
      .eq("organisation_id", tenantContext.organisationId)
      .eq("store_id", tenantContext.storeId)
      .eq("scan_id", scan.id)
      .in("product_id", orderedProductIds),
    supabaseAdmin
      .from("product_decisions")
      .select(
        `
          product_id,
          decision,
          confidence,
          risk,
          automation_allowed,
          requires_human_approval,
          readiness,
          readiness_blocking_reasons,
          reasons,
          blockers,
          warnings,
          engine_version,
          evaluated_at
        `
      )
      .eq("organisation_id", tenantContext.organisationId)
      .eq("store_id", tenantContext.storeId)
      .eq("scan_id", scan.id)
      .in("product_id", orderedProductIds),
    getCostAnalysisByScanProduct({
      tenantContext,
      scanId: scan.id,
      productIds: orderedProductIds,
    }),
    getSupplierReliabilityByScanProduct({
      tenantContext,
      scanId: scan.id,
      productIds: orderedProductIds,
    }),
  ]);

  if (productsError) {
    throw new Error(`Failed to load saved products: ${productsError.message}`);
  }

  if (intelligenceError) {
    throw new Error(
      `Failed to load saved intelligence: ${intelligenceError.message}`
    );
  }

  if (decisionsError) {
    throw new Error(`Failed to load saved decisions: ${decisionsError.message}`);
  }

  const productById = new Map(
    ((productRows || []) as ProductRow[]).map((row) => [row.id, row])
  );

  const intelligenceByProduct = new Map(
    ((intelligenceRows || []) as IntelligenceRow[]).map((row) => [
      row.product_id,
      row,
    ])
  );

  const decisionByProduct = new Map(
    ((decisionRows || []) as ProductDecisionRow[]).map((row) => [
      row.product_id,
      mapProductDecisionRow(row),
    ])
  );

  const baseProducts = orderedProductIds.flatMap((productId) => {
    const productRow = productById.get(productId);

    if (!productRow) return [];

    const intelligence = intelligenceByProduct.get(productId);
    const decision = decisionByProduct.get(productId);
    const costAnalysis = costByProduct.get(productId);
    const supplierReliability = supplierByProduct.get(productId);

    return [
      {
        ...productRow.raw_data,
        databaseId: productRow.id,
        organisationId: tenantContext.organisationId,
        storeId: tenantContext.storeId,
        aiScore: intelligence?.overall_score ?? productRow.raw_data.aiScore,
        intelligence:
          intelligence?.analysis ?? productRow.raw_data.intelligence,
        decision: decision ?? productRow.raw_data.decision,
        costAnalysis: costAnalysis ?? productRow.raw_data.costAnalysis,
        supplierReliability:
          supplierReliability ?? productRow.raw_data.supplierReliability,
        currentLifecycle:
          productRow.raw_data.currentLifecycle ||
          productRow.current_lifecycle ||
          undefined,
        lifecycleStatus:
          productRow.raw_data.lifecycleStatus ||
          productRow.lifecycle_status ||
          undefined,
        lifecycleChangedAt:
          productRow.raw_data.lifecycleChangedAt ||
          productRow.lifecycle_changed_at ||
          undefined,
      },
    ];
  });
  const products = await Promise.all(
    baseProducts.map(async (product) => ({
      ...product,
      memory:
        (await getMemoryForProduct({
          tenantContext,
          product,
        })) || product.memory,
    }))
  );

  return {
    tenantContext,
    scanId: scan.id,
    totalProducts: scan.total_found,
    recommendedProducts: scan.total_recommended,
    products,
    sources,
    memoryDashboard: await getProductMemoryDashboard(tenantContext),
    providerHealth: await getEvidenceProviderHealth(tenantContext),
  };
}
