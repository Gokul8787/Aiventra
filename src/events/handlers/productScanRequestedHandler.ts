import { DomainEvent } from "@/events/types";
import { enqueueProductScanJob } from "@/services/jobs/enqueueProductScanJob";
import { EventHandler } from "./types";

export const productScanRequestedHandler: EventHandler = {
  name: "product-scan-requested-handler",
  eventType: "ProductScanRequested",

  async handle(event: DomainEvent): Promise<void> {
    const searchQuery = String(event.payload.searchQuery || "pet");

    await enqueueProductScanJob({
      tenantContext: event.tenantContext,
      searchQuery,
      correlationId: event.id,
      causationId: event.id,
    });
  },
};
