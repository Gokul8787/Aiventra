import "server-only";
import { supabaseAdmin } from "@/services/supabase/admin";
import { Product } from "@/ai/types/product";
import type { TenantContext } from "@/context/storeContext";
import { requireTenantContext, tenantColumns } from "@/context/storeContext";

export type PersistedProduct = {
  id: string;
  organisation_id: string;
  store_id: string;
  provider: string;
  external_product_id: string;
};

function normaliseProvider(product: Product): string {
  const source = product.provider || product.supplier || "unknown";

  return source
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function getExternalProductId(product: Product): string {
  return String(product.id);
}

export function getProductPersistenceKey(product: Product): string {
  return `${normaliseProvider(product)}:${getExternalProductId(product)}`;
}

export async function upsertProducts(
  tenantContext: TenantContext,
  products: Product[]
): Promise<Map<string, PersistedProduct>> {
  const context = requireTenantContext(tenantContext);

  if (products.length === 0) {
    return new Map();
  }

  const now = new Date().toISOString();

  const rows = products.map((product) => ({
    ...tenantColumns(context),
    provider: normaliseProvider(product),
    external_product_id: getExternalProductId(product),

    name: product.name,
    category: product.category,
    supplier: product.supplier,

    supplier_price: product.supplierPrice,
    suggested_sell_price: product.sellPrice,
    currency: product.currency || "GBP",

    shipping_days: product.shippingDays,
    stock: product.stock ?? null,

    image_url: product.imageUrl || null,
    source_url: product.sourceUrl || null,

    average_rating: product.averageRating ?? null,
    review_count: product.reviewCount ?? null,

    raw_data: {
      ...product,
      organisationId: context.organisationId,
      storeId: context.storeId,
      currency: product.currency || context.currency,
    },
    last_seen_at: now,
    updated_at: now,
  }));

  const { data, error } = await supabaseAdmin
    .from("products")
    .upsert(rows, {
      onConflict: "organisation_id,store_id,provider,external_product_id",
    })
    .select("id, organisation_id, store_id, provider, external_product_id");

  if (error) {
    throw new Error(`Failed to upsert products: ${error.message}`);
  }

  const result = new Map<string, PersistedProduct>();

  for (const row of (data || []) as PersistedProduct[]) {
    result.set(`${row.provider}:${row.external_product_id}`, row);
  }

  return result;
}
