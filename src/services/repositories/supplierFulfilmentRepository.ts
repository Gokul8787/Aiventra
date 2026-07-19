import "server-only";

import type { Product } from "@/ai/types/product";
import type { TenantContext } from "@/context/storeContext";
import { tenantColumns } from "@/context/storeContext";
import type { FulfilmentCheckResult } from "@/fulfilment/types";
import { supabaseAdmin } from "@/services/supabase/admin";
import type {
  SupplierCapability,
  SupplierProductReference,
  SupplierProvider,
} from "@/suppliers/types";

export type SupplierAccountRecord = {
  id: string;
  provider: SupplierProvider;
  name: string;
  priority: number;
};

export type SupplierMappingRecord = {
  id: string;

  productId: string;
  supplierAccountId: string;

  supplierProductId: string;
  supplierVariantId?: string;
  supplierSku?: string;
  warehouseId?: string;
  shippingMethodId?: string;

  preferred: boolean;
};

export type SupplierMappingWithAccountRecord = SupplierMappingRecord & {
  provider: SupplierProvider;
  supplierName: string;
  accountPriority: number;
};

export type FulfilmentCheckRecord = FulfilmentCheckResult & {
  id: string;
  orderId: string;
  status: "pending" | "checking" | "passed" | "review" | "blocked" | "failed";
  supplierName?: string;
  provider?: SupplierProvider;
  checkedAt?: string;
};

type SupplierAccountRow = {
  id: string;
  provider: string;
  name: string;
  priority: number;
};

type SupplierMappingRow = {
  id: string;
  product_id: string;
  supplier_account_id: string;
  supplier_product_id: string;
  supplier_variant_id: string | null;
  supplier_sku: string | null;
  warehouse_id: string | null;
  shipping_method_id: string | null;
  preferred: boolean;
  supplier_accounts:
    | {
        provider: string;
        name: string;
        priority: number;
        status: string;
      }
    | Array<{
        provider: string;
        name: string;
        priority: number;
        status: string;
      }>;
};

type FulfilmentCheckRow = {
  id: string;
  order_id: string;
  order_item_id: string;
  status: FulfilmentCheckRecord["status"];
  supplier_account_id: string | null;
  supplier_product_mapping_id: string | null;
  inventory_available: boolean | null;
  available_quantity: number | null;
  latest_unit_cost: number | string | null;
  original_unit_cost: number | string | null;
  cost_change_percent: number | string | null;
  shipping_cost: number | string | null;
  delivery_days_min: number | null;
  delivery_days_max: number | null;
  shipping_method: string | null;
  estimated_net_profit: number | string | null;
  estimated_net_margin_percent: number | string | null;
  decision: FulfilmentCheckResult["decision"];
  blockers: string[];
  warnings: string[];
  reasons: string[];
  raw_evidence: Record<string, unknown>;
  checked_at: string | null;
  supplier_accounts:
    | {
        provider: string;
        name: string;
      }
    | Array<{
        provider: string;
        name: string;
      }>
    | null;
};

function toNumber(value: unknown): number | undefined {
  if (value === null || value === undefined) return undefined;

  const parsed = Number(value);

  return Number.isFinite(parsed) ? parsed : undefined;
}

function mapProvider(value: string): SupplierProvider {
  if (value === "cjdropshipping") return "cj";

  return value as SupplierProvider;
}

function isCJProduct(product: Product): boolean {
  return (
    product.provider === "cj" ||
    product.provider === "cjdropshipping" ||
    product.supplier.toLowerCase().includes("cj")
  );
}

export async function getSupplierAccounts(
  context: TenantContext
): Promise<SupplierAccountRecord[]> {
  const { data, error } = await supabaseAdmin
    .from("supplier_accounts")
    .select("id, provider, name, priority")
    .eq("organisation_id", context.organisationId)
    .eq("store_id", context.storeId)
    .eq("status", "active")
    .order("priority", {
      ascending: false,
    });

  if (error) {
    throw new Error(`Failed to load supplier accounts: ${error.message}`);
  }

  return ((data || []) as SupplierAccountRow[]).map((row) => ({
    id: row.id,
    provider: mapProvider(row.provider),
    name: row.name,
    priority: row.priority,
  }));
}

export async function getProductSupplierMappings(
  context: TenantContext,
  productId: string
): Promise<SupplierMappingWithAccountRecord[]> {
  const { data, error } = await supabaseAdmin
    .from("supplier_product_mappings")
    .select(
      `
        id,
        product_id,
        supplier_account_id,
        supplier_product_id,
        supplier_variant_id,
        supplier_sku,
        warehouse_id,
        shipping_method_id,
        preferred,
        supplier_accounts!inner (
          provider,
          name,
          priority,
          status
        )
      `
    )
    .eq("organisation_id", context.organisationId)
    .eq("store_id", context.storeId)
    .eq("product_id", productId)
    .eq("active", true)
    .eq("supplier_accounts.status", "active");

  if (error) {
    throw new Error(`Failed to load supplier mappings: ${error.message}`);
  }

  return ((data || []) as SupplierMappingRow[])
    .map((row) => {
      const account = Array.isArray(row.supplier_accounts)
        ? row.supplier_accounts[0]
        : row.supplier_accounts;

      return {
        id: row.id,
        productId: row.product_id,
        supplierAccountId: row.supplier_account_id,
        supplierProductId: row.supplier_product_id,
        supplierVariantId: row.supplier_variant_id || undefined,
        supplierSku: row.supplier_sku || undefined,
        warehouseId: row.warehouse_id || undefined,
        shippingMethodId: row.shipping_method_id || undefined,
        preferred: row.preferred,
        provider: mapProvider(account.provider),
        supplierName: account.name,
        accountPriority: account.priority,
      };
    })
    .sort((a, b) => {
      if (a.preferred !== b.preferred) {
        return a.preferred ? -1 : 1;
      }

      return b.accountPriority - a.accountPriority;
    });
}

export async function getSupplierMappingById(
  context: TenantContext,
  mappingId: string
): Promise<SupplierMappingWithAccountRecord | null> {
  const { data, error } = await supabaseAdmin
    .from("supplier_product_mappings")
    .select(
      `
        id,
        product_id,
        supplier_account_id,
        supplier_product_id,
        supplier_variant_id,
        supplier_sku,
        warehouse_id,
        shipping_method_id,
        preferred,
        supplier_accounts!inner (
          provider,
          name,
          priority,
          status
        )
      `
    )
    .eq("organisation_id", context.organisationId)
    .eq("store_id", context.storeId)
    .eq("id", mappingId)
    .eq("active", true)
    .eq("supplier_accounts.status", "active")
    .maybeSingle<SupplierMappingRow>();

  if (error) {
    throw new Error(`Failed to load supplier mapping: ${error.message}`);
  }

  if (!data) return null;

  const account = Array.isArray(data.supplier_accounts)
    ? data.supplier_accounts[0]
    : data.supplier_accounts;

  return {
    id: data.id,
    productId: data.product_id,
    supplierAccountId: data.supplier_account_id,
    supplierProductId: data.supplier_product_id,
    supplierVariantId: data.supplier_variant_id || undefined,
    supplierSku: data.supplier_sku || undefined,
    warehouseId: data.warehouse_id || undefined,
    shippingMethodId: data.shipping_method_id || undefined,
    preferred: data.preferred,
    provider: mapProvider(account.provider),
    supplierName: account.name,
    accountPriority: account.priority,
  };
}

export function toSupplierProductReference(
  mapping: SupplierMappingRecord
): SupplierProductReference {
  return {
    supplierProductId: mapping.supplierProductId,
    supplierVariantId: mapping.supplierVariantId,
    supplierSku: mapping.supplierSku,
    warehouseId: mapping.warehouseId,
  };
}

export async function saveFulfilmentCheck(input: {
  context: TenantContext;
  orderId: string;
  result: FulfilmentCheckResult;
}): Promise<string> {
  const now = new Date().toISOString();
  const { data, error } = await supabaseAdmin
    .from("fulfilment_checks")
    .upsert(
      {
        ...tenantColumns(input.context),
        order_id: input.orderId,
        order_item_id: input.result.orderItemId,
        supplier_account_id: input.result.supplierAccountId || null,
        supplier_product_mapping_id: input.result.supplierMappingId || null,
        status:
          input.result.decision === "AUTO_FULFIL"
            ? "passed"
            : input.result.decision === "MANUAL_REVIEW"
              ? "review"
              : "blocked",
        inventory_available: input.result.inventoryAvailable ?? null,
        available_quantity: input.result.availableQuantity ?? null,
        latest_unit_cost: input.result.latestUnitCost ?? null,
        original_unit_cost: input.result.originalUnitCost ?? null,
        cost_change_percent: input.result.costChangePercent ?? null,
        shipping_cost: input.result.shippingCost ?? null,
        delivery_days_min: input.result.deliveryDaysMin ?? null,
        delivery_days_max: input.result.deliveryDaysMax ?? null,
        shipping_method: input.result.shippingMethod || null,
        estimated_net_profit: input.result.estimatedNetProfit ?? null,
        estimated_net_margin_percent:
          input.result.estimatedNetMarginPercent ?? null,
        decision: input.result.decision,
        blockers: input.result.blockers,
        warnings: input.result.warnings,
        reasons: input.result.reasons,
        raw_evidence: input.result.rawEvidence,
        checked_at: now,
        updated_at: now,
      },
      {
        onConflict: "order_item_id",
      }
    )
    .select("id")
    .single<{ id: string }>();

  if (error || !data) {
    throw new Error(
      `Failed to save fulfilment check: ${error?.message || "No row returned"}`
    );
  }

  return data.id;
}

export async function getFulfilmentChecksForOrder(
  context: TenantContext,
  orderId: string
): Promise<FulfilmentCheckRecord[]> {
  const { data, error } = await supabaseAdmin
    .from("fulfilment_checks")
    .select(
      `
        *,
        supplier_accounts (
          provider,
          name
        )
      `
    )
    .eq("organisation_id", context.organisationId)
    .eq("store_id", context.storeId)
    .eq("order_id", orderId)
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error(`Failed to load fulfilment checks: ${error.message}`);
  }

  return ((data || []) as FulfilmentCheckRow[]).map((row) => {
    const account = Array.isArray(row.supplier_accounts)
      ? row.supplier_accounts[0]
      : row.supplier_accounts;

    return {
      id: row.id,
      orderId: row.order_id,
      orderItemId: row.order_item_id,
      status: row.status,
      decision: row.decision,
      supplierAccountId: row.supplier_account_id || undefined,
      supplierMappingId: row.supplier_product_mapping_id || undefined,
      supplierName: account?.name || undefined,
      provider: account?.provider ? mapProvider(account.provider) : undefined,
      inventoryAvailable: row.inventory_available ?? undefined,
      availableQuantity: row.available_quantity ?? undefined,
      latestUnitCost: toNumber(row.latest_unit_cost),
      originalUnitCost: toNumber(row.original_unit_cost),
      costChangePercent: toNumber(row.cost_change_percent),
      shippingCost: toNumber(row.shipping_cost),
      deliveryDaysMin: row.delivery_days_min ?? undefined,
      deliveryDaysMax: row.delivery_days_max ?? undefined,
      shippingMethod: row.shipping_method || undefined,
      estimatedNetProfit: toNumber(row.estimated_net_profit),
      estimatedNetMarginPercent: toNumber(row.estimated_net_margin_percent),
      blockers: row.blockers || [],
      warnings: row.warnings || [],
      reasons: row.reasons || [],
      rawEvidence: row.raw_evidence || {},
      checkedAt: row.checked_at || undefined,
    };
  });
}

export async function getOrCreateSupplierAccount(input: {
  context: TenantContext;
  provider: SupplierProvider;
  name: string;
  capabilities: SupplierCapability[];
}): Promise<SupplierAccountRecord> {
  const { data, error } = await supabaseAdmin
    .from("supplier_accounts")
    .upsert(
      {
        ...tenantColumns(input.context),
        provider: input.provider,
        name: input.name,
        status: "active",
        priority: 100,
        capabilities: input.capabilities,
        updated_at: new Date().toISOString(),
      },
      {
        onConflict: "organisation_id,store_id,provider,name",
      }
    )
    .select("id, provider, name, priority")
    .single<SupplierAccountRow>();

  if (error || !data) {
    throw new Error(
      `Failed to upsert supplier account: ${error?.message || "No row returned"}`
    );
  }

  return {
    id: data.id,
    provider: mapProvider(data.provider),
    name: data.name,
    priority: data.priority,
  };
}

export async function upsertSupplierProductMapping(input: {
  context: TenantContext;
  productId: string;
  supplierAccountId: string;
  supplierProductId: string;
  supplierVariantId?: string;
  supplierSku?: string;
  preferred?: boolean;
  metadata?: Record<string, unknown>;
}): Promise<string> {
  const existingQuery = supabaseAdmin
    .from("supplier_product_mappings")
    .select("id")
    .eq("organisation_id", input.context.organisationId)
    .eq("store_id", input.context.storeId)
    .eq("product_id", input.productId)
    .eq("supplier_account_id", input.supplierAccountId)
    .eq("supplier_product_id", input.supplierProductId)
    .limit(1);

  const { data: existingRows, error: existingError } = input.supplierVariantId
    ? await existingQuery.eq("supplier_variant_id", input.supplierVariantId)
    : await existingQuery.is("supplier_variant_id", null);

  if (existingError) {
    throw new Error(
      `Failed to find supplier mapping: ${existingError.message}`
    );
  }

  const row = {
    ...tenantColumns(input.context),
    product_id: input.productId,
    supplier_account_id: input.supplierAccountId,
    supplier_product_id: input.supplierProductId,
    supplier_variant_id: input.supplierVariantId || null,
    supplier_sku: input.supplierSku || null,
    active: true,
    preferred: input.preferred ?? true,
    last_verified_at: new Date().toISOString(),
    metadata: input.metadata || {},
    updated_at: new Date().toISOString(),
  };

  if (existingRows?.[0]?.id) {
    const { data, error } = await supabaseAdmin
      .from("supplier_product_mappings")
      .update(row)
      .eq("id", existingRows[0].id)
      .select("id")
      .single<{ id: string }>();

    if (error || !data) {
      throw new Error(
        `Failed to update supplier mapping: ${error?.message || "No row returned"}`
      );
    }

    return data.id;
  }

  const { data, error } = await supabaseAdmin
    .from("supplier_product_mappings")
    .insert(row)
    .select("id")
    .single<{ id: string }>();

  if (error || !data) {
    throw new Error(
      `Failed to insert supplier mapping: ${error?.message || "No row returned"}`
    );
  }

  return data.id;
}

export async function upsertPublishedProductSupplierMapping(input: {
  context: TenantContext;
  product: Product;
}): Promise<string | null> {
  if (!input.product.databaseId || !isCJProduct(input.product)) {
    return null;
  }

  const account = await getOrCreateSupplierAccount({
    context: input.context,
    provider: "cj",
    name: "CJ Dropshipping Main",
    capabilities: [
      "inventory",
      "pricing",
      "shipping_quote",
      "order_creation",
      "order_status",
      "cancellation",
    ],
  });

  return upsertSupplierProductMapping({
    context: input.context,
    productId: input.product.databaseId,
    supplierAccountId: account.id,
    supplierProductId: input.product.id,
    supplierVariantId: input.product.variantId,
    supplierSku: input.product.sku,
    preferred: true,
    metadata: {
      source: "shopify_draft_publishing",
      provider: input.product.provider,
      supplier: input.product.supplier,
    },
  });
}
