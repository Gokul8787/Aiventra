import { shopifyGraphQL } from "@/services/connectors/shopify/client";
import type { FulfilmentLookupInput, FulfilmentOrder } from "../FulfilmentProvider";
import { mapShopifyFulfilmentOrder } from "./mapFulfilment";
import type { ShopifyFulfilmentOrdersQuery } from "./types";

const GET_FULFILMENT_ORDERS_QUERY = `
  query AiventraFulfilmentOrders($orderId: ID!) {
    order(id: $orderId) {
      id
      cancelledAt
      displayFinancialStatus
      displayFulfillmentStatus
      totalRefundedSet {
        shopMoney {
          amount
        }
      }
      fulfillments(first: 20) {
        nodes {
          id
          status
          trackingInfo(first: 10) {
            company
            number
            url
          }
        }
      }
      fulfillmentOrders(first: 20) {
        nodes {
          id
          status
          requestStatus
          supportedActions {
            action
          }
          lineItems(first: 50) {
            nodes {
              id
              remainingQuantity
              lineItem {
                id
                sku
                quantity
              }
            }
          }
          fulfillments(first: 20) {
            nodes {
              id
              status
              trackingInfo(first: 10) {
                company
                number
                url
              }
            }
          }
        }
      }
    }
  }
`;

export async function getShopifyFulfilmentOrders(
  input: FulfilmentLookupInput
): Promise<{
  orderCancelled: boolean;
  refunded: boolean;
  orderFulfilmentStatus?: string;
  fulfilmentOrders: FulfilmentOrder[];
  existingOrderFulfilments: Array<{
    id: string;
    status: string;
    trackingNumbers: string[];
    trackingUrls: string[];
  }>;
}> {
  const orderId = input.order.shopifyAdminGraphqlApiId || input.order.shopifyOrderId;
  const data = await shopifyGraphQL<ShopifyFulfilmentOrdersQuery>(
    GET_FULFILMENT_ORDERS_QUERY,
    { orderId }
  );

  if (!data.order) {
    throw new Error("Shopify order could not be found for fulfilment.");
  }

  const refundedAmount = Number(
    data.order.totalRefundedSet?.shopMoney?.amount || "0"
  );

  return {
    orderCancelled: Boolean(data.order.cancelledAt),
    refunded: refundedAmount > 0,
    orderFulfilmentStatus: data.order.displayFulfillmentStatus || undefined,
    fulfilmentOrders: data.order.fulfillmentOrders.nodes.map(
      mapShopifyFulfilmentOrder
    ),
    existingOrderFulfilments: (data.order.fulfillments?.nodes || []).map(
      (fulfilment) => ({
        id: fulfilment.id,
        status: fulfilment.status,
        trackingNumbers: (fulfilment.trackingInfo || [])
          .map((info) => info.number || "")
          .filter(Boolean),
        trackingUrls: (fulfilment.trackingInfo || [])
          .map((info) => info.url || "")
          .filter(Boolean),
      })
    ),
  };
}
