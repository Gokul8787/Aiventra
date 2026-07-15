import type { SupplierConnector } from "../SupplierConnector";
import type {
  SupplierInventoryInput,
  SupplierInventoryResult,
  SupplierPriceInput,
  SupplierPriceResult,
  SupplierShippingQuoteInput,
  SupplierShippingQuoteResult,
} from "../types";

import { testCJConnection } from "@/services/cjdropshipping/connection";
import { getCJInventory } from "@/services/cjdropshipping/inventory";
import { getCJProductCost } from "@/services/cjdropshipping/productCost";
import { getCJShippingQuote } from "@/services/cjdropshipping/shipping";

export class CJConnector implements SupplierConnector {
  readonly id = "cj" as const;
  readonly name = "CJ Dropshipping";

  readonly capabilities = ["inventory", "pricing", "shipping_quote"] as const;

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
}
