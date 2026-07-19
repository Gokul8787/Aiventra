import { DomainEvent } from "@/events/types";
import {
  getProductScanSearchLabel,
  parseProductScanRequest,
} from "@/services/productDiscovery/productScanRequest";
import { enqueueProductScanJob } from "@/services/jobs/enqueueProductScanJob";
import { EventHandler } from "./types";

export const productScanRequestedHandler: EventHandler = {
  name: "product-scan-requested-handler",
  eventType: "ProductScanRequested",

  async handle(event: DomainEvent): Promise<void> {
    const request = parseProductScanRequest(
      event.payload.request || {
        mode: event.payload.mode || "broad",
        categoryId: event.payload.categoryId,
        keyword: event.payload.keyword,
      }
    );
    const searchQuery = String(
      event.payload.searchQuery || getProductScanSearchLabel(request)
    );

    await enqueueProductScanJob({
      tenantContext: event.tenantContext,
      request,
      searchQuery,
      correlationId: event.id,
      causationId: event.id,
    });
  },
};
