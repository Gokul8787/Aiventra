import "server-only";

import type { Product } from "@/ai/types/product";
import type { TenantContext } from "@/context/storeContext";
import { getProductPersistenceKey, PersistedProduct } from "@/services/repositories/productsRepository";
import { LifecycleEngine } from "./LifecycleEngine";
import {
  canTransition,
  getCurrentLifecycle,
} from "./LifecycleRepository";
import type { ProductLifecycleStage } from "./ProductLifecycle";

export async function moveIfAllowed(input: {
  tenantContext: TenantContext;
  product: Product;
  productId: string;
  to: ProductLifecycleStage;
  reason: string;
  actor: string;
}) {
  const current = await getCurrentLifecycle(
    input.tenantContext,
    input.productId
  );

  if (!canTransition(current?.stage, input.to)) {
    return null;
  }

  if (current?.stage === input.to) {
    return null;
  }

  return LifecycleEngine.move(input.product, input.to, {
    tenantContext: input.tenantContext,
    productId: input.productId,
    reason: input.reason,
    actor: input.actor,
  });
}

export async function applyProductHunterLifecycle(input: {
  tenantContext: TenantContext;
  products: Product[];
  persistedProducts: Map<string, PersistedProduct>;
}) {
  for (const product of input.products) {
    const persistedProduct = input.persistedProducts.get(
      getProductPersistenceKey(product)
    );

    if (!persistedProduct) continue;

    await moveIfAllowed({
      tenantContext: input.tenantContext,
      product,
      productId: persistedProduct.id,
      to: "ANALYSED",
      actor: "product-hunter",
      reason: "Product Hunter completed intelligence analysis.",
    });

    if (product.decision?.decision === "PUBLISH") {
      await moveIfAllowed({
        tenantContext: input.tenantContext,
        product,
        productId: persistedProduct.id,
        to: "AI_APPROVED",
        actor: "decision-engine",
        reason: "Decision Engine approved product for publishing.",
      });
    }
  }
}
