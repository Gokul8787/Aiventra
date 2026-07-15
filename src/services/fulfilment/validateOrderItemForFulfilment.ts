import "server-only";

import type { TenantContext } from "@/context/storeContext";
import type { FulfilmentCheckResult } from "@/fulfilment/types";
import type { SupplierAddress } from "@/suppliers/types";
import { evaluateFulfilmentCheck } from "@/fulfilment/evaluator";
import {
  getProductSupplierMappings,
  toSupplierProductReference,
} from "@/services/repositories/supplierFulfilmentRepository";
import { getSupplierConnector } from "@/suppliers/SupplierRegistry";
import { registerSupplierConnectors } from "@/suppliers/registerSupplierConnectors";

type ValidateOrderItemInput = {
  tenantContext: TenantContext;

  orderItem: {
    id: string;
    quantity: number;
    unitPrice: number;

    productId?: string;
    originalUnitCost?: number;
  };

  destination: SupplierAddress;
  currency: string;
};

export async function validateOrderItemForFulfilment(
  input: ValidateOrderItemInput
): Promise<FulfilmentCheckResult> {
  registerSupplierConnectors();

  if (!input.orderItem.productId) {
    return evaluateFulfilmentCheck({
      orderItem: input.orderItem,
    });
  }

  const mappings = await getProductSupplierMappings(
    input.tenantContext,
    input.orderItem.productId
  );

  if (mappings.length === 0) {
    return evaluateFulfilmentCheck({
      orderItem: input.orderItem,
    });
  }

  const mapping = mappings[0];
  const connector = getSupplierConnector(mapping.provider);
  const supplierProduct = toSupplierProductReference(mapping);

  const [inventory, pricing, shipping] = await Promise.all([
    connector.checkInventory({
      product: supplierProduct,
      quantity: input.orderItem.quantity,
    }),
    connector.getCurrentPrice({
      product: supplierProduct,
      quantity: input.orderItem.quantity,
      currency: input.currency,
    }),
    connector.getShippingQuote({
      product: supplierProduct,
      quantity: input.orderItem.quantity,
      destination: input.destination,
      currency: input.currency,
    }),
  ]);

  return evaluateFulfilmentCheck({
    orderItem: input.orderItem,
    mapping,
    evidence: {
      inventory,
      pricing,
      shipping,
    },
  });
}
