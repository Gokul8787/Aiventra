import "server-only";

import type { TenantContext } from "@/context/storeContext";
import { RecoveryPermanentError, RecoveryRetryableError } from "@/recovery/errors";
import {
  appendSupplierOrderEvent,
  getSupplierOrderById,
  markSupplierOrderCancelled,
} from "@/services/repositories/supplierOrderRepository";
import { getSupplierConnector } from "@/suppliers/SupplierRegistry";
import { registerSupplierConnectors } from "@/suppliers/registerSupplierConnectors";

export async function cancelSupplierOrder(input: {
  tenantContext: TenantContext;
  supplierOrderId: string;
  reason?: string;
}) {
  registerSupplierConnectors();

  const supplierOrder = await getSupplierOrderById(
    input.tenantContext,
    input.supplierOrderId
  );

  if (!supplierOrder) {
    throw new RecoveryPermanentError(
      "Supplier order was not found.",
      "SUPPLIER_ORDER_NOT_FOUND"
    );
  }

  if (supplierOrder.status === "CANCELLED") {
    return {
      success: true,
      duplicate: true,
      status: "CANCELLED" as const,
    };
  }

  if (["SHIPPED", "DELIVERED"].includes(supplierOrder.status)) {
    throw new RecoveryPermanentError(
      "Supplier order has already shipped.",
      "SUPPLIER_ORDER_TOO_LATE"
    );
  }

  if (!supplierOrder.externalOrderId) {
    throw new RecoveryPermanentError(
      "Supplier order has no external order ID.",
      "SUPPLIER_EXTERNAL_ID_MISSING"
    );
  }

  const connector = getSupplierConnector(supplierOrder.provider);
  const result = await connector.cancelOrder(supplierOrder.externalOrderId);

  if (!result.success || !result.cancelled) {
    if (result.retryable) {
      throw new RecoveryRetryableError(
        result.message || "Supplier cancellation temporarily failed.",
        "SUPPLIER_CANCELLATION_TEMPORARY"
      );
    }

    throw new RecoveryPermanentError(
      result.message || "Supplier cancellation failed.",
      "SUPPLIER_CANCELLATION_REJECTED"
    );
  }

  await markSupplierOrderCancelled({
    context: input.tenantContext,
    supplierOrderId: supplierOrder.id,
    responsePayload: result.raw,
  });

  await appendSupplierOrderEvent({
    context: input.tenantContext,
    supplierOrderId: supplierOrder.id,
    eventType: "CANCELLATION_CONFIRMED",
    message:
      input.reason || "Supplier cancellation was confirmed by recovery flow.",
    payload: {
      provider: supplierOrder.provider,
      externalOrderId: supplierOrder.externalOrderId,
    },
  });

  return {
    success: true,
    duplicate: false,
    status: "CANCELLED" as const,
  };
}
