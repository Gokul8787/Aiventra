import { shopifyGraphQL } from "@/services/connectors/shopify/client";
import type { CreateFulfilmentInput, CreateFulfilmentResult } from "../FulfilmentProvider";
import { mapShopifyCreateFulfilmentResult } from "./mapFulfilment";
import type { ShopifyFulfilmentCreateMutation } from "./types";

const CREATE_FULFILMENT_MUTATION = `
  mutation AiventraFulfillmentCreate($fulfillment: FulfillmentInput!, $message: String) {
    fulfillmentCreate(fulfillment: $fulfillment, message: $message) {
      fulfillment {
        id
        status
        trackingInfo(first: 10) {
          company
          number
          url
        }
      }
      userErrors {
        field
        message
      }
    }
  }
`;

function formatErrors(
  errors: Array<{ field?: string[] | null; message: string }>
) {
  return errors
    .map((error) =>
      error.field?.length ? `${error.field.join(".")}: ${error.message}` : error.message
    )
    .join("; ");
}

export async function createShopifyFulfilment(input: CreateFulfilmentInput & {
}): Promise<CreateFulfilmentResult> {
  const groupedLineItems = Array.from(
    input.lineItems.reduce(
      (groups, lineItem) => {
        const existing = groups.get(lineItem.fulfilmentOrderId) || [];
        existing.push(lineItem);
        groups.set(lineItem.fulfilmentOrderId, existing);
        return groups;
      },
      new Map<string, CreateFulfilmentInput["lineItems"]>()
    )
  ).map(([fulfilmentOrderId, items]) => ({
    fulfilmentOrderId,
    items,
  }));

  if (!groupedLineItems.length) {
    throw new Error("Shopify fulfilment creation requires mapped line items.");
  }

  const data = await shopifyGraphQL<ShopifyFulfilmentCreateMutation>(
    CREATE_FULFILMENT_MUTATION,
    {
      fulfillment: {
        notifyCustomer: input.notifyCustomer,
        trackingInfo: {
          company: input.shipment.courier || undefined,
          number: input.shipment.trackingNumber || undefined,
          url: input.shipment.trackingUrl || undefined,
          numbers: input.shipment.trackingNumber ? [input.shipment.trackingNumber] : [],
          urls: input.shipment.trackingUrl ? [input.shipment.trackingUrl] : [],
        },
        lineItemsByFulfillmentOrder: groupedLineItems.map(
          ({ fulfilmentOrderId, items }) => ({
            fulfillmentOrderId: fulfilmentOrderId,
            fulfillmentOrderLineItems: items.map((item) => ({
              id: item.fulfilmentOrderLineItemId,
              quantity: item.quantity,
            })),
          })
        ),
      },
      message: "Fulfilled by Aiventra",
    }
  );

  const result = data.fulfillmentCreate;

  if (result.userErrors.length) {
    throw new Error(`Shopify fulfilment creation failed: ${formatErrors(result.userErrors)}`);
  }

  if (!result.fulfillment) {
    throw new Error("Shopify did not return a fulfilment.");
  }

  return mapShopifyCreateFulfilmentResult({
    fulfilment: result.fulfillment,
    externalOrderId: input.order.shopifyAdminGraphqlApiId || input.order.shopifyOrderId,
    externalFulfilmentOrderIds: groupedLineItems.map(
      ({ fulfilmentOrderId }) => fulfilmentOrderId
    ),
    customerNotified: input.notifyCustomer,
    raw: data as Record<string, unknown>,
  });
}
