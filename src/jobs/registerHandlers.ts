import type { TenantContext } from "@/context/storeContext";
import type { JobMessage } from "@/jobs/types";
import { registerJobHandler } from "./handlerRegistry";
import { cjShippingQuoteHandler } from "./handlers/cjShippingQuoteHandler";
import { orderValidationHandler } from "./handlers/orderValidationHandler";
import { handleProductScanJob } from "./handlers/productScanJobHandler";

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
      const resultReference = await handleProductScanJob({
        tenantContext: tenantContextFromMessage(message),
        jobId: message.jobId,
        searchQuery: String(message.payload.searchQuery ?? "pet"),
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
  registerJobHandler(orderValidationHandler);

  registered = true;
}
