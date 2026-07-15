import { DomainEvent } from "@/events/types";
import { enqueueOrderValidationJob } from "@/services/jobs/enqueueOrderValidationJob";
import { EventHandler } from "./types";

export const shopifyOrderReceivedHandler: EventHandler = {
  name: "shopify-order-received-handler",
  eventType: "OrderReceived",

  async handle(event: DomainEvent): Promise<void> {
    const orderId = String(event.payload.orderId || event.aggregateId);

    await enqueueOrderValidationJob({
      tenantContext: event.tenantContext,
      orderId,
      correlationId: event.id,
      causationId: event.id,
    });
  },
};
