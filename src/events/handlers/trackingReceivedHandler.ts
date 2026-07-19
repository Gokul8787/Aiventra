import { DomainEvent } from "@/events/types";
import { enqueuePlatformFulfilmentJob } from "@/services/jobs/enqueuePlatformFulfilmentJob";
import { EventHandler } from "./types";

export const trackingReceivedHandler: EventHandler = {
  name: "tracking-received-handler",
  eventType: "TrackingReceived",

  async handle(event: DomainEvent): Promise<void> {
    const orderId = String(event.payload.orderId || event.aggregateId || "");
    const shipmentTrackingId = String(event.payload.shipmentTrackingId || "");

    if (!orderId || !shipmentTrackingId) {
      throw new Error("TrackingReceived event is missing orderId or shipmentTrackingId.");
    }

    await enqueuePlatformFulfilmentJob({
      tenantContext: event.tenantContext,
      orderId,
      shipmentTrackingId,
      supplierOrderId: String(event.payload.supplierOrderId || "") || undefined,
      correlationId: event.id,
      causationId: event.id,
    });
  },
};
