import "server-only";

import type { TenantContext } from "@/context/storeContext";
import { publishEvent } from "@/services/events/eventRepository";
import { getSupplierConnector } from "@/suppliers/SupplierRegistry";
import { registerSupplierConnectors } from "@/suppliers/registerSupplierConnectors";
import type {
  SupplierTrackingResult,
  SupplierTrackingStatus,
} from "@/suppliers/types";
import {
  saveDeliveryEvent,
  saveShipmentTracking,
  saveTrackingEvents,
} from "@/services/repositories/trackingRepository";
import { getPlatformFulfilmentByShipment } from "@/services/repositories/platformFulfilmentRepository";
import { getStorePlatform } from "@/services/repositories/storeRepository";
import {
  appendSupplierOrderEvent,
  getSupplierOrderById,
  updateSupplierOrderTracking,
} from "@/services/repositories/supplierOrderRepository";

function calculateNextTrackingSync(
  status: SupplierTrackingResult["status"]
): string | undefined {
  const now = Date.now();

  switch (status) {
    case "PENDING":
    case "INFO_RECEIVED":
      return new Date(now + 3 * 60 * 60 * 1000).toISOString();
    case "IN_TRANSIT":
    case "OUT_FOR_DELIVERY":
      return new Date(now + 6 * 60 * 60 * 1000).toISOString();
    case "EXCEPTION":
      return new Date(now + 60 * 60 * 1000).toISOString();
    default:
      return undefined;
  }
}

function mapShipmentStatus(
  status: SupplierTrackingStatus
): "pending" | "tracking_pending" | "in_transit" | "out_for_delivery" | "delivered" | "exception" | "returned" | "cancelled" | "unknown" {
  switch (status) {
    case "PENDING":
      return "pending";
    case "INFO_RECEIVED":
      return "tracking_pending";
    case "IN_TRANSIT":
      return "in_transit";
    case "OUT_FOR_DELIVERY":
      return "out_for_delivery";
    case "DELIVERED":
      return "delivered";
    case "EXCEPTION":
      return "exception";
    case "RETURNED":
      return "returned";
    case "CANCELLED":
      return "cancelled";
    default:
      return "unknown";
  }
}

function mapEventStatus(
  status: SupplierTrackingStatus
): "pending" | "label_created" | "shipped" | "in_transit" | "out_for_delivery" | "delivered" | "exception" | "returned" | "cancelled" | "unknown" {
  switch (status) {
    case "PENDING":
      return "pending";
    case "INFO_RECEIVED":
      return "label_created";
    case "IN_TRANSIT":
      return "in_transit";
    case "OUT_FOR_DELIVERY":
      return "out_for_delivery";
    case "DELIVERED":
      return "delivered";
    case "EXCEPTION":
      return "exception";
    case "RETURNED":
      return "returned";
    case "CANCELLED":
      return "cancelled";
    default:
      return "unknown";
  }
}

export async function syncSupplierTracking(input: {
  tenantContext: TenantContext;
  supplierOrderId: string;
}) {
  registerSupplierConnectors();

  const supplierOrder = await getSupplierOrderById(
    input.tenantContext,
    input.supplierOrderId
  );

  if (!supplierOrder) {
    throw new Error("Supplier order not found.");
  }

  if (!supplierOrder.externalOrderId) {
    throw new Error("Supplier order has no external order ID.");
  }

  if (["CANCELLED", "FAILED"].includes(supplierOrder.status)) {
    return {
      supplierOrderId: supplierOrder.id,
      terminal: true,
      status: supplierOrder.status,
    };
  }

  const connector = getSupplierConnector(supplierOrder.provider);
  const tracking = await connector.getTracking(supplierOrder.externalOrderId);

  if (!tracking.success) {
    throw new Error(
      tracking.message || "Supplier tracking request failed."
    );
  }

  const nextTrackingSyncAt = calculateNextTrackingSync(tracking.status);

  await updateSupplierOrderTracking({
    context: input.tenantContext,
    supplierOrderId: supplierOrder.id,
    trackingNumber: tracking.trackingNumber,
    trackingUrl: tracking.trackingUrl,
    carrierCode: tracking.carrierCode,
    carrierName: tracking.carrierName,
    trackingStatus: tracking.status,
    shippedAt: tracking.shippedAt,
    deliveredAt: tracking.deliveredAt,
    lastTrackingSyncedAt: tracking.checkedAt,
    nextTrackingSyncAt,
    responsePayload: tracking.raw,
  });

  const shipment = await saveShipmentTracking({
    context: input.tenantContext,
    shipment: {
      orderId: supplierOrder.orderId,
      supplierOrderId: supplierOrder.id,
      provider: supplierOrder.provider,
      trackingNumber: tracking.trackingNumber,
      courier: tracking.carrierName,
      trackingUrl: tracking.trackingUrl,
      status: mapShipmentStatus(tracking.status),
      shippedAt: tracking.shippedAt,
      deliveredAt: tracking.deliveredAt,
      lastSyncAt: tracking.checkedAt,
      lastEventAt: tracking.events.at(-1)?.eventAt,
      lastEventSummary: tracking.events.at(-1)?.description,
      rawData: {
        requestId: tracking.requestId,
        carrierCode: tracking.carrierCode,
        externalOrderId: tracking.externalOrderId,
        nextTrackingSyncAt,
      },
    },
  });

  if (tracking.events.length) {
    await saveTrackingEvents({
      context: input.tenantContext,
      events: tracking.events.map((event) => ({
        shipmentTrackingId: shipment.id,
        provider: supplierOrder.provider,
        externalEventId: event.externalEventId,
        eventCode: event.rawStatus,
        status: mapEventStatus(event.status),
        summary: event.description,
        location: event.location,
        occurredAt: event.eventAt,
        rawData: {
          rawStatus: event.rawStatus,
          ...(event.raw || {}),
        },
      })),
    });
  }

  if (tracking.status === "DELIVERED" && tracking.deliveredAt) {
    await saveDeliveryEvent({
      context: input.tenantContext,
      event: {
        orderId: supplierOrder.orderId,
        shipmentTrackingId: shipment.id,
        eventType: "DELIVERED",
        status: "delivered",
        message: "Supplier tracking indicates delivery completed.",
        occurredAt: tracking.deliveredAt,
        rawData: {
          carrier: tracking.carrierName,
          trackingNumber: tracking.trackingNumber,
        },
      },
    });
  }

  await appendSupplierOrderEvent({
    context: input.tenantContext,
    supplierOrderId: supplierOrder.id,
    eventType: "TRACKING_SYNCHRONISED",
    message: `Tracking synchronised: ${tracking.status}`,
    payload: {
      trackingNumber: tracking.trackingNumber,
      carrier: tracking.carrierName,
      requestId: tracking.requestId,
      nextTrackingSyncAt,
    },
  });

  if (tracking.trackingNumber) {
    const platform = await getStorePlatform(input.tenantContext);
    const existingPlatformFulfilment = await getPlatformFulfilmentByShipment({
      tenantContext: input.tenantContext,
      shipmentTrackingId: shipment.id,
      platform,
    });

    if (!existingPlatformFulfilment?.externalFulfilmentId) {
      await publishEvent({
        tenantContext: input.tenantContext,
        eventType: "TrackingReceived",
        aggregateType: "order",
        aggregateId: supplierOrder.orderId,
        payload: {
          orderId: supplierOrder.orderId,
          supplierOrderId: supplierOrder.id,
          shipmentTrackingId: shipment.id,
          trackingNumber: tracking.trackingNumber,
          trackingStatus: tracking.status,
          platform,
        },
        metadata: {
          idempotencyKey: [
            shipment.id,
            tracking.trackingNumber,
            platform,
          ].join(":"),
        },
      });
    }
  }

  return {
    supplierOrderId: supplierOrder.id,
    shipmentId: shipment.id,
    status: tracking.status,
    trackingNumber: tracking.trackingNumber,
    nextTrackingSyncAt,
    terminal: ["DELIVERED", "RETURNED", "CANCELLED"].includes(tracking.status),
  };
}
