import type { SupplierConnector } from "../SupplierConnector";
import type {
  SupplierInventoryInput,
  SupplierInventoryResult,
  SupplierOrderCreationInput,
  SupplierOrderCreationResult,
  SupplierOrderStatusResult,
  SupplierTrackingResult,
  SupplierCancellationResult,
  SupplierPriceInput,
  SupplierPriceResult,
  SupplierShippingQuoteInput,
  SupplierShippingQuoteResult,
} from "../types";

import { testCJConnection } from "@/services/cjdropshipping/connection";
import { getCJInventory } from "@/services/cjdropshipping/inventory";
import { getCJProductCost } from "@/services/cjdropshipping/productCost";
import { getCJShippingQuote } from "@/services/cjdropshipping/shipping";
import { cancelCJOrder } from "@/services/cjdropshipping/orders/cancelOrder";
import { createCJOrder } from "@/services/cjdropshipping/orders/createOrder";
import { getCJOrder } from "@/services/cjdropshipping/orders/getOrder";
import { getCJTracking } from "@/services/cjdropshipping/tracking/getTracking";

export class CJConnector implements SupplierConnector {
  readonly id = "cj" as const;
  readonly name = "CJ Dropshipping";

  readonly capabilities = [
    "inventory",
    "pricing",
    "shipping_quote",
    "order_creation",
    "order_status",
    "tracking",
    "cancellation",
  ] as const;

  async testConnection() {
    return testCJConnection();
  }

  async checkInventory(
    input: SupplierInventoryInput
  ): Promise<SupplierInventoryResult> {
    const result = await getCJInventory({
      productId: input.product.supplierProductId,
      variantId: input.product.supplierVariantId,
      quantity: input.quantity,
      warehouseId: input.product.warehouseId,
    });

    return {
      available: result.availableQuantity >= input.quantity,
      availableQuantity: result.availableQuantity,
      warehouseId: result.warehouseId,
      checkedAt: new Date().toISOString(),
      raw: result.raw,
    };
  }

  async getCurrentPrice(input: SupplierPriceInput): Promise<SupplierPriceResult> {
    const result = await getCJProductCost({
      productId: input.product.supplierProductId,
      variantId: input.product.supplierVariantId,
      quantity: input.quantity,
      currency: input.currency,
    });

    return {
      unitCost: result.unitCost,
      currency: result.currency,
      minimumQuantity: result.minimumQuantity,
      checkedAt: new Date().toISOString(),
      raw: result.raw,
    };
  }

  async getShippingQuote(
    input: SupplierShippingQuoteInput
  ): Promise<SupplierShippingQuoteResult> {
    const result = await getCJShippingQuote({
      productId: input.product.supplierProductId,
      variantId: input.product.supplierVariantId,
      quantity: input.quantity,
      destinationCountry: input.destination.countryCode,
      postalCode: input.destination.postalCode,
      currency: input.currency,
    });

    return {
      options: [
        {
          id: result.id,
          name: result.carrier || "CJ Shipping",
          cost: result.shippingCost,
          currency: result.currency,
          deliveryDaysMin: result.deliveryDays,
          deliveryDaysMax: result.deliveryDays,
          trackingAvailable: true,
          raw: result.raw as Record<string, unknown>,
        },
      ],
      checkedAt: new Date().toISOString(),
    };
  }

  async createOrder(
    input: SupplierOrderCreationInput
  ): Promise<SupplierOrderCreationResult> {
    const result = await createCJOrder({
      clientOrderReference: input.clientOrderReference,
      currency: input.currency,
      destination: input.destination,
      shippingMethodId: input.shippingMethodId,
      metadata: input.metadata,
      items: input.items.map((item) => ({
        orderItemId: item.orderItemId,
        productId: item.product.supplierProductId,
        variantId: item.product.supplierVariantId,
        sku: item.product.supplierSku,
        warehouseId: item.product.warehouseId,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        currency: item.currency,
        shippingMethodId: item.shippingMethodId,
      })),
    });

    return {
      success: result.success,
      externalOrderId: result.orderId,
      status: result.status,
      paymentRequired: true,
      productCost: result.productCost,
      shippingCost: result.shippingCost,
      totalCost: result.totalCost,
      raw: result.raw,
      apiUsage: result.apiUsage,
      errorMessage: result.success
        ? undefined
        : "CJ did not return an external order ID.",
    };
  }

  async getOrderStatus(
    externalOrderId: string
  ): Promise<SupplierOrderStatusResult> {
    return getCJOrder(externalOrderId);
  }

  async getTracking(
    externalOrderId: string
  ): Promise<SupplierTrackingResult> {
    return getCJTracking(externalOrderId);
  }

  async cancelOrder(
    externalOrderId: string
  ): Promise<SupplierCancellationResult> {
    return cancelCJOrder(externalOrderId);
  }
}
