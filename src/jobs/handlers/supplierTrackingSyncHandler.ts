import "server-only";

import type { TenantContext } from "@/context/storeContext";
import type { JobMessage } from "@/jobs/types";
import { syncSupplierTracking } from "@/services/fulfilment/syncSupplierTracking";
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

export const supplierTrackingSyncHandler: JobHandler = {
  jobType: "SUPPLIER_TRACKING_SYNC",

  async handle({ message, reportProgress }) {
    const supplierOrderId = String(message.payload.supplierOrderId || "");

    if (!supplierOrderId) {
      throw new Error("supplierOrderId is required.");
    }

    await reportProgress(10, "Loading supplier shipment");
    await reportProgress(35, "Requesting supplier tracking");

    const result = await syncSupplierTracking({
      tenantContext: tenantContextFromMessage(message),
      supplierOrderId,
    });

    await reportProgress(80, "Saving tracking events");
    await reportProgress(100, "Tracking synchronised");

    return {
      resultReference: result,
    };
  },
};
