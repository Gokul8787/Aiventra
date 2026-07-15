import "server-only";

import type { Product } from "@/ai/types/product";
import type { TenantContext } from "@/context/storeContext";
import { createSupplierSnapshot } from "@/ai/supplier/createSupplierSnapshot";
import { analyseSupplierReliability } from "@/ai/supplier/supplierReliabilityEngine";
import { loadSupplierHistory } from "@/services/repositories/supplierReliabilityRepository";

export async function enrichProductWithSupplierReliability(
  tenantContext: TenantContext,
  product: Product
): Promise<Product> {
  const supplierSnapshot = createSupplierSnapshot(product);

  const historicalSnapshots = await loadSupplierHistory({
    tenantContext,
    provider: supplierSnapshot.provider,
    supplierId: supplierSnapshot.supplierId,
    externalProductId: supplierSnapshot.externalProductId,
    limit: 90,
  });

  const supplierReliability = analyseSupplierReliability([
    ...historicalSnapshots,
    supplierSnapshot,
  ]);

  return {
    ...product,
    supplierSnapshot,
    supplierReliability,
  };
}
