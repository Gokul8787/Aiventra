import "server-only";

import type { TenantContext } from "@/context/storeContext";
import type { JobMessage } from "@/jobs/types";
import { createPlatformFulfilment } from "@/services/fulfilment/createPlatformFulfilment";
import type { JobHandler } from "./types";

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

export const shopifyFulfilmentHandler: JobHandler = {
  jobType: "SHOPIFY_FULFILMENT",

  async handle({ message, reportProgress }) {
    const orderId = String(message.payload.orderId || "");
    const shipmentTrackingId = String(message.payload.shipmentTrackingId || "");

    if (!orderId || !shipmentTrackingId) {
      throw new Error("orderId and shipmentTrackingId are required.");
    }

    await reportProgress(15, "Loading shipment and order state");
    await reportProgress(40, "Resolving fulfilment provider");

    const result = await createPlatformFulfilment({
      tenantContext: tenantContextFromMessage(message),
      orderId,
      shipmentTrackingId,
      supplierOrderId: String(message.payload.supplierOrderId || "") || undefined,
    });

    await reportProgress(80, "Persisting platform fulfilment");
    await reportProgress(100, "Platform fulfilment completed");

    return {
      resultReference: result,
    };
  },
};
