import type {
  CreateFulfilmentResult,
  FulfilmentOrder,
} from "../FulfilmentProvider";
import type {
  ShopifyFulfilmentNode,
  ShopifyFulfilmentOrderNode,
} from "./types";

function trackingNumbers(node: ShopifyFulfilmentNode) {
  return (node.trackingInfo || [])
    .map((info) => info.number || "")
    .filter(Boolean);
}

function trackingUrls(node: ShopifyFulfilmentNode) {
  return (node.trackingInfo || [])
    .map((info) => info.url || "")
    .filter(Boolean);
}

export function mapShopifyFulfilmentOrder(
  node: ShopifyFulfilmentOrderNode
): FulfilmentOrder {
  return {
    id: node.id,
    status: node.status,
    requestStatus: node.requestStatus || undefined,
    supportedActions: (node.supportedActions || []).map((item) => item.action),
    lineItems: node.lineItems.nodes.map((lineItem) => ({
      id: lineItem.id,
      lineItemId: lineItem.lineItem?.id || undefined,
      remainingQuantity: Number(lineItem.remainingQuantity || 0),
      quantity: lineItem.lineItem?.quantity || undefined,
      sku: lineItem.lineItem?.sku || undefined,
    })),
    existingFulfilments: (node.fulfillments?.nodes || []).map((fulfilment) => ({
      id: fulfilment.id,
      status: fulfilment.status,
      trackingNumbers: trackingNumbers(fulfilment),
      trackingUrls: trackingUrls(fulfilment),
      carrier: fulfilment.trackingInfo?.[0]?.company || undefined,
    })),
  };
}

export function mapShopifyCreateFulfilmentResult(input: {
  fulfilment: {
    id: string;
    status: string;
    trackingInfo?: Array<{
      company?: string | null;
      number?: string | null;
      url?: string | null;
    }> | null;
  };
  externalOrderId: string;
  externalFulfilmentOrderIds: string[];
  customerNotified: boolean;
  raw?: Record<string, unknown>;
}): CreateFulfilmentResult {
  const firstTracking = input.fulfilment.trackingInfo?.[0];

  return {
    success: true,
    externalFulfilmentId: input.fulfilment.id,
    externalOrderId: input.externalOrderId,
    externalFulfilmentOrderIds: input.externalFulfilmentOrderIds,
    trackingNumber: firstTracking?.number || undefined,
    trackingUrl: firstTracking?.url || undefined,
    carrier: firstTracking?.company || undefined,
    status: input.fulfilment.status,
    customerNotified: input.customerNotified,
    raw: input.raw,
  };
}
