import "server-only";

import type { TenantContext } from "@/context/storeContext";
import { publishEvent } from "@/services/events/eventRepository";
import { getFulfilmentProvider } from "@/fulfilment/providers/FulfilmentRegistry";
import type {
  FulfilmentOrder,
  PlatformFulfilmentLineItem,
} from "@/fulfilment/providers/FulfilmentProvider";
import { registerFulfilmentProviders } from "@/fulfilment/providers/registerFulfilmentProviders";
import {
  getOrderById,
  getOrderItems,
  markOrderItemsFulfilled,
} from "@/services/repositories/orderRepository";
import {
  appendPlatformFulfilmentEvent,
  getPlatformFulfilmentByShipment,
  upsertPlatformFulfilment,
} from "@/services/repositories/platformFulfilmentRepository";
import { getStorePlatform } from "@/services/repositories/storeRepository";
import { getShipmentTrackingById } from "@/services/repositories/trackingRepository";
import {
  getSupplierOrderById,
  listSupplierOrderItems,
} from "@/services/repositories/supplierOrderRepository";
import { assertOrderWorkAllowed } from "@/services/recovery/assertOrderWorkAllowed";

function hasBlockingOrderState(order: Awaited<ReturnType<typeof getOrderById>>) {
  if (!order) return "Order not found.";
  if (order.cancelledAt || order.status === "cancelled") return "Order is cancelled.";
  if (order.refundedAt || order.status === "refunded") return "Order is refunded.";
  if (["awaiting_fulfilment_approval", "manual_review", "blocked"].includes(order.status)) {
    return "Order is on manual hold.";
  }
  return undefined;
}

function normaliseShopifyId(value?: string) {
  if (!value) return "";
  return value.split("/").pop() || value;
}

function buildFulfilmentLineItems(input: {
  orderItems: Awaited<ReturnType<typeof getOrderItems>>;
  supplierOrderItems: Awaited<ReturnType<typeof listSupplierOrderItems>>;
  providerOrders: FulfilmentOrder[];
}): PlatformFulfilmentLineItem[] {
  const providerLineItems = input.providerOrders
    .filter((providerOrder) =>
      providerOrder.supportedActions.includes("CREATE_FULFILLMENT")
    )
    .flatMap((providerOrder) =>
      providerOrder.lineItems.map((lineItem) => ({
        fulfilmentOrderId: providerOrder.id,
        fulfilmentOrderLineItemId: lineItem.id,
        platformLineItemId: lineItem.lineItemId || "",
        remainingQuantity: lineItem.remainingQuantity,
      }))
    );

  return input.supplierOrderItems.flatMap((supplierOrderItem) => {
    const orderItem = input.orderItems.find(
      (item) => item.id === supplierOrderItem.orderItemId
    );

    if (!orderItem) {
      return [];
    }

    const matchingLineItem = providerLineItems.find((lineItem) => {
      const left = normaliseShopifyId(lineItem.platformLineItemId);
      const right = normaliseShopifyId(orderItem.shopifyLineItemId);

      return Boolean(left) && left === right;
    });

    if (!matchingLineItem || matchingLineItem.remainingQuantity <= 0) {
      return [];
    }

    return [
      {
        orderItemId: orderItem.id,
        platformLineItemId: matchingLineItem.platformLineItemId,
        fulfilmentOrderId: matchingLineItem.fulfilmentOrderId,
        fulfilmentOrderLineItemId: matchingLineItem.fulfilmentOrderLineItemId,
        quantity: Math.min(
          supplierOrderItem.quantity,
          matchingLineItem.remainingQuantity
        ),
      },
    ];
  });
}

export async function createPlatformFulfilment(input: {
  tenantContext: TenantContext;
  orderId: string;
  shipmentTrackingId: string;
  supplierOrderId?: string;
}) {
  registerFulfilmentProviders();

  const [order, items, shipment, platform, supplierOrder, supplierOrderItems] =
    await Promise.all([
    getOrderById(input.tenantContext, input.orderId),
    getOrderItems(input.tenantContext, input.orderId),
    getShipmentTrackingById(input.tenantContext, input.shipmentTrackingId),
    getStorePlatform(input.tenantContext),
    input.supplierOrderId
      ? getSupplierOrderById(input.tenantContext, input.supplierOrderId)
      : Promise.resolve(null),
    input.supplierOrderId
      ? listSupplierOrderItems(input.tenantContext, input.supplierOrderId)
      : Promise.resolve([]),
    ]);

  const blockingReason = hasBlockingOrderState(order);
  if (blockingReason) {
    throw new Error(blockingReason);
  }

  if (!order || !shipment) {
    throw new Error("Order or shipment could not be loaded.");
  }

  if (!shipment.trackingNumber) {
    throw new Error("Shipment tracking number is missing.");
  }

  const existing = await getPlatformFulfilmentByShipment({
    tenantContext: input.tenantContext,
    shipmentTrackingId: shipment.id,
    platform,
  });

  const provider = getFulfilmentProvider(platform);
  const providerOrders = await provider.getFulfilmentOrders({
    tenantContext: input.tenantContext,
    order,
    items,
    shipment,
  });
  const lineItems = buildFulfilmentLineItems({
    orderItems: items,
    supplierOrderItems,
    providerOrders,
  });
  const affectedOrderItemIds = Array.from(
    new Set(lineItems.map((lineItem) => lineItem.orderItemId))
  );

  const duplicate = providerOrders
    .flatMap((providerOrder) => providerOrder.existingFulfilments)
    .find((fulfilment) =>
      fulfilment.trackingNumbers.includes(shipment.trackingNumber || "")
    );

  if (existing?.externalFulfilmentId) {
    await provider.updateTracking({
      tenantContext: input.tenantContext,
      externalFulfilmentId: existing.externalFulfilmentId,
      trackingNumber: shipment.trackingNumber,
      trackingUrl: shipment.trackingUrl,
      carrier: shipment.courier,
      notifyCustomer: existing.customerNotified,
    });

    const saved = await upsertPlatformFulfilment({
      tenantContext: input.tenantContext,
      orderId: order.id,
      shipmentTrackingId: shipment.id,
      supplierOrderId: supplierOrder?.id,
      platform,
      externalFulfilmentId: existing.externalFulfilmentId,
      externalOrderId: order.shopifyAdminGraphqlApiId || order.shopifyOrderId,
      externalFulfilmentOrderIds: existing.externalFulfilmentOrderIds,
      trackingNumber: shipment.trackingNumber,
      trackingUrl: shipment.trackingUrl,
      carrier: shipment.courier,
      status: "fulfilled",
      customerNotified: existing.customerNotified,
      rawResponse: existing.rawResponse,
      fulfilledAt: existing.fulfilledAt || new Date().toISOString(),
    });

    await appendPlatformFulfilmentEvent({
      tenantContext: input.tenantContext,
      platformFulfilmentId: saved.id,
      eventType: "TRACKING_UPDATED",
      status: "fulfilled",
      message: "Platform fulfilment tracking updated.",
      dedupeScope: shipment.trackingNumber,
      payload: {
        trackingNumber: shipment.trackingNumber,
      },
    });

    return {
      status: "updated" as const,
      platformFulfilment: saved,
    };
  }

  if (duplicate) {
    const saved = await upsertPlatformFulfilment({
      tenantContext: input.tenantContext,
      orderId: order.id,
      shipmentTrackingId: shipment.id,
      supplierOrderId: supplierOrder?.id,
      platform,
      externalFulfilmentId: duplicate.id,
      externalOrderId: order.shopifyAdminGraphqlApiId || order.shopifyOrderId,
      externalFulfilmentOrderIds: providerOrders.map((providerOrder) => providerOrder.id),
      trackingNumber: shipment.trackingNumber,
      trackingUrl: shipment.trackingUrl,
      carrier: shipment.courier,
      status: "fulfilled",
      customerNotified: true,
      rawResponse: {
        deduplicated: true,
      },
      fulfilledAt: new Date().toISOString(),
    });

    await appendPlatformFulfilmentEvent({
      tenantContext: input.tenantContext,
      platformFulfilmentId: saved.id,
      eventType: "DEDUPLICATED",
      status: "fulfilled",
      message: "Existing platform fulfilment detected.",
      dedupeScope: duplicate.id,
      payload: {
        externalFulfilmentId: duplicate.id,
      },
    });

    await markOrderItemsFulfilled({
      tenantContext: input.tenantContext,
      orderId: order.id,
      orderItemIds: affectedOrderItemIds,
    });

    return {
      status: "already_exists" as const,
      platformFulfilment: saved,
    };
  }

  const creatableOrders = providerOrders.filter(
    (providerOrder) =>
      providerOrder.lineItems.some((item) => item.remainingQuantity > 0) &&
      providerOrder.supportedActions.includes("CREATE_FULFILLMENT")
  );

  if (!creatableOrders.length) {
    throw new Error("Platform does not currently accept fulfilment for this order.");
  }

  if (!input.supplierOrderId) {
    throw new Error("Supplier order is required for item-scoped platform fulfilment.");
  }

  if (!lineItems.length) {
    throw new Error("No mapped supplier order items are eligible for fulfilment.");
  }

  await assertOrderWorkAllowed(order.id);

  const created = await provider.createFulfilment({
    tenantContext: input.tenantContext,
    order,
    items,
    shipment,
    notifyCustomer: true,
    lineItems,
  });

  const saved = await upsertPlatformFulfilment({
    tenantContext: input.tenantContext,
    orderId: order.id,
    shipmentTrackingId: shipment.id,
    supplierOrderId: supplierOrder?.id,
    platform,
    externalFulfilmentId: created.externalFulfilmentId,
    externalOrderId: created.externalOrderId,
    externalFulfilmentOrderIds: created.externalFulfilmentOrderIds,
    trackingNumber: created.trackingNumber || shipment.trackingNumber,
    trackingUrl: created.trackingUrl || shipment.trackingUrl,
    carrier: created.carrier || shipment.courier,
    status: "fulfilled",
    customerNotified: created.customerNotified,
    rawResponse: created.raw,
    fulfilledAt: new Date().toISOString(),
  });

  await appendPlatformFulfilmentEvent({
    tenantContext: input.tenantContext,
    platformFulfilmentId: saved.id,
    eventType: "CREATED",
    status: "fulfilled",
    message: "Platform fulfilment created.",
    dedupeScope: created.externalFulfilmentId || shipment.trackingNumber,
    payload: {
      externalFulfilmentId: created.externalFulfilmentId,
      trackingNumber: created.trackingNumber,
    },
  });

  await markOrderItemsFulfilled({
    tenantContext: input.tenantContext,
    orderId: order.id,
    orderItemIds: affectedOrderItemIds,
  });

  await publishEvent({
    tenantContext: input.tenantContext,
    eventType: "Fulfilled",
    aggregateType: "order",
    aggregateId: order.id,
    payload: {
      orderId: order.id,
      shipmentTrackingId: shipment.id,
      platformFulfilmentId: saved.id,
      externalFulfilmentId: created.externalFulfilmentId,
    },
  });

  return {
    status: "created" as const,
    platformFulfilment: saved,
  };
}
