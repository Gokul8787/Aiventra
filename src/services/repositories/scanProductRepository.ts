import "server-only";
import { supabaseAdmin } from "@/services/supabase/admin";
import { Product } from "@/ai/types/product";
import type { TenantContext } from "@/context/storeContext";
import { tenantColumns } from "@/context/storeContext";
import {
  getProductPersistenceKey,
  PersistedProduct,
} from "./productsRepository";

export async function linkProductsToScan(input: {
  tenantContext: TenantContext;
  scanId: string;
  products: Product[];
  recommendedProductIds: Set<string>;
  persistedProducts: Map<string, PersistedProduct>;
}): Promise<void> {
  const sortedRecommendations = input.products
    .filter((product) => input.recommendedProductIds.has(product.id))
    .sort((a, b) => b.aiScore - a.aiScore);

  const rankByProductId = new Map(
    sortedRecommendations.map((product, index) => [product.id, index + 1])
  );

  const rows = input.products.flatMap((product) => {
    const persistedProduct = input.persistedProducts.get(
      getProductPersistenceKey(product)
    );

    if (!persistedProduct) return [];

    const recommended = input.recommendedProductIds.has(product.id);

    return [
      {
        ...tenantColumns(input.tenantContext),
        scan_id: input.scanId,
        product_id: persistedProduct.id,
        recommended,
        rank: recommended ? rankByProductId.get(product.id) || null : null,
      },
    ];
  });

  if (rows.length === 0) return;

  const { error } = await supabaseAdmin.from("scan_products").upsert(rows, {
    onConflict: "scan_id,product_id",
  });

  if (error) {
    throw new Error(`Failed to link products to scan: ${error.message}`);
  }
}
