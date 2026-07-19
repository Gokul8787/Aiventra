import type {
  CancelFulfilmentInput,
  CreateFulfilmentInput,
  CreateFulfilmentResult,
  FulfilmentLookupInput,
  FulfilmentOrder,
  FulfilmentProvider,
  UpdateTrackingInput,
} from "../FulfilmentProvider";
import { createShopifyFulfilment } from "./createFulfilment";
import { getShopifyFulfilmentOrders } from "./getFulfilmentOrders";
import { updateShopifyFulfilmentTracking } from "./updateTracking";

export class ShopifyFulfilmentProvider implements FulfilmentProvider {
  readonly id = "shopify";
  readonly name = "Shopify";

  async getFulfilmentOrders(input: FulfilmentLookupInput): Promise<FulfilmentOrder[]> {
    const result = await getShopifyFulfilmentOrders(input);
    return result.fulfilmentOrders;
  }

  async createFulfilment(
    input: CreateFulfilmentInput
  ): Promise<CreateFulfilmentResult> {
    const lookup = await getShopifyFulfilmentOrders(input);
    const actionableOrderIds = new Set(
      lookup.fulfilmentOrders
        .filter((order) => order.supportedActions.includes("CREATE_FULFILLMENT"))
        .map((order) => order.id)
    );
    const fulfilmentOrderIds = Array.from(
      new Set(
        input.lineItems
          .filter((item) => actionableOrderIds.has(item.fulfilmentOrderId))
          .map((item) => item.fulfilmentOrderId)
      )
    );

    if (!fulfilmentOrderIds.length) {
      throw new Error("Shopify has no fulfilment orders remaining for this order.");
    }

    return createShopifyFulfilment(input);
  }

  async updateTracking(input: UpdateTrackingInput): Promise<void> {
    await updateShopifyFulfilmentTracking(input);
  }

  async cancelFulfilment(input: CancelFulfilmentInput): Promise<void> {
    void input;

    throw new Error("Shopify fulfilment cancellation is not implemented yet.");
  }
}
