import "server-only";

import type { Product } from "@/ai/types/product";
import type {
  SupplierReliabilityAnalysis,
  SupplierSnapshot,
} from "@/ai/supplier/types";
import type { TenantContext } from "@/context/storeContext";
import { tenantColumns } from "@/context/storeContext";
import { supabaseAdmin } from "@/services/supabase/admin";
import {
  getProductPersistenceKey,
  PersistedProduct,
} from "./productsRepository";

type SupplierSnapshotRow = {
  provider: string;
  supplier_id: string;
  external_product_id: string;
  supplier_price: number | string | null;
  stock: number | null;
  quoted_delivery_days: number | null;
  shipping_cost: number | string | null;
  actual_delivery_days: number | null;
  order_accurate: boolean | null;
  refunded: boolean | null;
  supplier_response_hours: number | string | null;
  observed_at: string;
};

type SupplierReliabilityRow = {
  product_id: string;
  analysis: SupplierReliabilityAnalysis | null;
};

function mapSupplierSnapshot(row: SupplierSnapshotRow): SupplierSnapshot {
  return {
    provider: row.provider,
    supplierId: row.supplier_id,
    externalProductId: row.external_product_id,
    supplierPrice:
      row.supplier_price == null ? undefined : Number(row.supplier_price),
    stock: row.stock == null ? undefined : Number(row.stock),
    quotedDeliveryDays:
      row.quoted_delivery_days == null
        ? undefined
        : Number(row.quoted_delivery_days),
    shippingCost: row.shipping_cost == null ? undefined : Number(row.shipping_cost),
    actualDeliveryDays:
      row.actual_delivery_days == null
        ? undefined
        : Number(row.actual_delivery_days),
    orderAccurate: row.order_accurate ?? undefined,
    refunded: row.refunded ?? undefined,
    supplierResponseHours:
      row.supplier_response_hours == null
        ? undefined
        : Number(row.supplier_response_hours),
    observedAt: row.observed_at,
  };
}

export async function saveSupplierSnapshots(input: {
  tenantContext: TenantContext;
  scanId: string;
  products: Product[];
  persistedProducts: Map<string, PersistedProduct>;
}): Promise<void> {
  const rows = input.products.flatMap((product) => {
    const snapshot = product.supplierSnapshot;

    if (!snapshot) return [];

    const persistedProduct = input.persistedProducts.get(
      getProductPersistenceKey(product)
    );

    if (!persistedProduct) return [];

    return [
      {
        ...tenantColumns(input.tenantContext),
        scan_id: input.scanId,
        product_id: persistedProduct.id,

        provider: snapshot.provider,
        supplier_id: snapshot.supplierId,
        external_product_id: snapshot.externalProductId,

        supplier_price: snapshot.supplierPrice ?? null,
        stock: snapshot.stock ?? null,
        quoted_delivery_days: snapshot.quotedDeliveryDays ?? null,
        shipping_cost: snapshot.shippingCost ?? null,

        actual_delivery_days: snapshot.actualDeliveryDays ?? null,
        order_accurate: snapshot.orderAccurate ?? null,
        refunded: snapshot.refunded ?? null,
        supplier_response_hours: snapshot.supplierResponseHours ?? null,

        observed_at: snapshot.observedAt,
      },
    ];
  });

  if (rows.length === 0) return;

  const { error } = await supabaseAdmin.from("supplier_snapshots").insert(rows);

  if (error) {
    throw new Error(`Failed to save supplier snapshots: ${error.message}`);
  }
}

export async function loadSupplierHistory(input: {
  tenantContext: TenantContext;
  provider: string;
  supplierId: string;
  externalProductId: string;
  limit?: number;
}): Promise<SupplierSnapshot[]> {
  const { data, error } = await supabaseAdmin
    .from("supplier_snapshots")
    .select("*")
    .eq("organisation_id", input.tenantContext.organisationId)
    .eq("store_id", input.tenantContext.storeId)
    .eq("provider", input.provider)
    .eq("supplier_id", input.supplierId)
    .eq("external_product_id", input.externalProductId)
    .order("observed_at", {
      ascending: false,
    })
    .limit(input.limit ?? 90);

  if (error) {
    throw new Error(`Failed to load supplier history: ${error.message}`);
  }

  return ((data || []) as SupplierSnapshotRow[]).map(mapSupplierSnapshot);
}

export async function saveSupplierReliability(input: {
  tenantContext: TenantContext;
  scanId: string;
  products: Product[];
  persistedProducts: Map<string, PersistedProduct>;
}): Promise<void> {
  const rows = input.products.flatMap((product) => {
    const analysis = product.supplierReliability;

    if (!analysis) return [];

    const persistedProduct = input.persistedProducts.get(
      getProductPersistenceKey(product)
    );

    if (!persistedProduct) return [];

    return [
      {
        ...tenantColumns(input.tenantContext),
        scan_id: input.scanId,
        product_id: persistedProduct.id,

        supplier_score: analysis.supplierScore,
        supplier_risk: analysis.supplierRisk,
        preferred_supplier: analysis.preferredSupplier,

        data_quality: analysis.dataQuality,
        sample_size: analysis.sampleSize,

        reasons: analysis.reasons,
        warnings: analysis.warnings,
        missing_evidence: analysis.missingEvidence,

        metrics: analysis.metrics,
        analysis,

        engine_version: analysis.engineVersion,
        calculated_at: analysis.lastUpdated,
      },
    ];
  });

  if (rows.length === 0) return;

  const { error } = await supabaseAdmin
    .from("supplier_reliability_snapshots")
    .insert(rows);

  if (error) {
    throw new Error(`Failed to save supplier reliability: ${error.message}`);
  }
}

export async function getSupplierReliabilityByScanProduct(input: {
  tenantContext: TenantContext;
  scanId: string;
  productIds: string[];
}): Promise<Map<string, SupplierReliabilityAnalysis>> {
  if (input.productIds.length === 0) return new Map();

  const { data, error } = await supabaseAdmin
    .from("supplier_reliability_snapshots")
    .select("product_id, analysis")
    .eq("organisation_id", input.tenantContext.organisationId)
    .eq("store_id", input.tenantContext.storeId)
    .eq("scan_id", input.scanId)
    .in("product_id", input.productIds);

  if (error) {
    throw new Error(`Failed to load supplier reliability: ${error.message}`);
  }

  return new Map(
    ((data || []) as SupplierReliabilityRow[]).flatMap((row) =>
      row.analysis ? [[row.product_id, row.analysis]] : []
    )
  );
}

export async function getLatestSupplierReliability(
  tenantContext: TenantContext,
  productId: string
): Promise<SupplierReliabilityAnalysis | null> {
  const { data, error } = await supabaseAdmin
    .from("supplier_reliability_snapshots")
    .select("analysis")
    .eq("organisation_id", tenantContext.organisationId)
    .eq("store_id", tenantContext.storeId)
    .eq("product_id", productId)
    .order("calculated_at", {
      ascending: false,
    })
    .limit(1)
    .maybeSingle<{ analysis: SupplierReliabilityAnalysis | null }>();

  if (error) {
    throw new Error(`Failed to load supplier reliability: ${error.message}`);
  }

  return data?.analysis ?? null;
}
