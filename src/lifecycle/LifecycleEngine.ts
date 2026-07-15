import type { Product } from "@/ai/types/product";
import type { TenantContext } from "@/context/storeContext";
import type {
  ProductLifecycleStage,
  ProductLifecycleStatus,
} from "./ProductLifecycle";
import {
  canTransition,
  moveToLifecycle,
} from "./LifecycleRepository";

export const LifecycleEngine = {
  canTransition,

  async move(
    product: Product,
    to: ProductLifecycleStage,
    input: {
      tenantContext: TenantContext;
      reason: string;
      actor: string;
      status?: ProductLifecycleStatus;
      productId?: string;
    }
  ) {
    const productId = input.productId || product.databaseId;

    if (!productId) {
      throw new Error("Cannot move lifecycle without a persisted product id.");
    }

    return moveToLifecycle({
      tenantContext: input.tenantContext,
      productId,
      to,
      reason: input.reason,
      actor: input.actor,
      status: input.status,
    });
  },
};
