import type { TenantContext } from "@/context/storeContext";
import type { JobMessage } from "@/jobs/types";
import {
  getProductScanSearchLabel,
  parseProductScanRequest,
} from "@/services/productDiscovery/productScanRequest";
import { registerJobHandler } from "./handlerRegistry";
import { cjShippingQuoteHandler } from "./handlers/cjShippingQuoteHandler";
import { deadLetterReplayHandler } from "./handlers/deadLetterReplayHandler";
import { orderCancellationHandler } from "./handlers/orderCancellationHandler";
import { orderValidationHandler } from "./handlers/orderValidationHandler";
import { handleProductScanJob } from "./handlers/productScanJobHandler";
import { recoveryRetryHandler } from "./handlers/recoveryRetryHandler";
import { shopifyFulfilmentHandler } from "./handlers/shopifyFulfilmentHandler";
import { supplierCancellationHandler } from "./handlers/supplierCancellationHandler";
import { supplierOrderCreationHandler } from "./handlers/supplierOrderCreationHandler";
import { supplierOrderStatusHandler } from "./handlers/supplierOrderStatusHandler";
import { supplierTrackingSyncHandler } from "./handlers/supplierTrackingSyncHandler";

let registered = false;

function tenantContextFromMessage(message: JobMessage): TenantContext {
  const payloadContext = message.payload.tenantContext as
    | Partial<TenantContext>
    | undefined;

  return {
    organisationId: message.organisationId,
    storeId: message.storeId,
    timezone: payloadContext?.timezone || "Europe/London",
    currency: payloadContext?.currency || "GBP",
    locale: payloadContext?.locale || "en-GB",
    userId: payloadContext?.userId,
    country: payloadContext?.country,
    organisationName: payloadContext?.organisationName,
    storeName: payloadContext?.storeName,
  };
}

export function registerJobHandlers() {
  if (registered) return;

  registerJobHandler({
    jobType: "PRODUCT_SCAN",

    async handle({ message }) {
      const request = parseProductScanRequest(
        message.payload.request || {
          mode: message.payload.mode || "broad",
          categoryId: message.payload.categoryId,
          keyword: message.payload.keyword,
        }
      );
      const resultReference = await handleProductScanJob({
        tenantContext: tenantContextFromMessage(message),
        jobId: message.jobId,
        request,
        searchQuery: String(
          message.payload.searchQuery || getProductScanSearchLabel(request)
        ),
        generateInsights:
          typeof message.payload.generateInsights === "boolean"
            ? message.payload.generateInsights
            : undefined,
      });

      return {
        resultReference,
      };
    },
  });

  registerJobHandler(cjShippingQuoteHandler);
  registerJobHandler(deadLetterReplayHandler);
  registerJobHandler(orderCancellationHandler);
  registerJobHandler(orderValidationHandler);
  registerJobHandler(recoveryRetryHandler);
  registerJobHandler(shopifyFulfilmentHandler);
  registerJobHandler(supplierCancellationHandler);
  registerJobHandler(supplierOrderCreationHandler);
  registerJobHandler(supplierOrderStatusHandler);
  registerJobHandler(supplierTrackingSyncHandler);

  registered = true;
}
