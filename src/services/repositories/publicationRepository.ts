import "server-only";

import type { TenantContext } from "@/context/storeContext";
import { tenantColumns } from "@/context/storeContext";
import { supabaseAdmin } from "@/services/supabase/admin";

// Tenant-owned rows include organisation_id and store_id via tenantColumns.

export async function saveShopifyPublication(input: {
  tenantContext: TenantContext;
  productId: string;
  externalProductId: string;
  externalVariantId?: string;
  externalUrl?: string;
  status: "draft" | "active" | "archived" | "failed";
}): Promise<void> {
  const { error } = await supabaseAdmin.from("product_publications").upsert(
    {
      ...tenantColumns(input.tenantContext),
      product_id: input.productId,
      store_id: input.tenantContext.storeId,
      platform: "shopify",
      external_product_id: input.externalProductId,
      shopify_variant_id: input.externalVariantId || null,
      external_url: input.externalUrl || null,
      status: input.status,
      published_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
      onConflict: "store_id,product_id",
    }
  );

  if (error) {
    throw new Error(`Failed to save Shopify publication: ${error.message}`);
  }
}
