import type {
  SupplierTrackingEvent,
  SupplierTrackingResult,
  SupplierTrackingStatus,
} from "@/suppliers/types";

import type {
  CJTrackingApiResponse,
  CJTrackingDataResponse,
  CJTrackingEventResponse,
} from "./types";

function normaliseText(value?: string): string {
  return (value || "").trim().toLowerCase();
}

export function mapCJTrackingStatus(
  rawStatus?: string
): SupplierTrackingStatus {
  const value = normaliseText(rawStatus);

  if (!value) {
    return "UNKNOWN";
  }

  if (
    value.includes("exception") ||
    value.includes("failed") ||
    value.includes("held") ||
    value.includes("delay") ||
    value.includes("undeliverable")
  ) {
    return "EXCEPTION";
  }

  if (value.includes("deliver") && !value.includes("out for")) {
    return "DELIVERED";
  }

  if (value.includes("out for delivery") || value.includes("courier")) {
    return "OUT_FOR_DELIVERY";
  }

  if (
    value.includes("transit") ||
    value.includes("depart") ||
    value.includes("arrive") ||
    value.includes("transport")
  ) {
    return "IN_TRANSIT";
  }

  if (
    value.includes("information received") ||
    value.includes("label created") ||
    value.includes("pre-shipment") ||
    value.includes("electronic information")
  ) {
    return "INFO_RECEIVED";
  }

  if (value.includes("return")) {
    return "RETURNED";
  }

  if (value.includes("cancel")) {
    return "CANCELLED";
  }

  if (value.includes("pending") || value.includes("created")) {
    return "PENDING";
  }

  return "UNKNOWN";
}

function mapTrackingEvent(event: CJTrackingEventResponse): SupplierTrackingEvent {
  const rawStatus =
    event.status || event.statusCode || event.description || event.details || "";
  const eventAt =
    event.eventTime ||
    event.trackingTime ||
    event.createDate ||
    new Date().toISOString();
  const location = [event.location, event.city, event.country]
    .filter(Boolean)
    .join(", ");

  return {
    externalEventId: event.id || event.trackingId,
    status: mapCJTrackingStatus(rawStatus),
    description: event.description || event.details || rawStatus || "Tracking update",
    location: location || undefined,
    eventAt,
    rawStatus,
    raw: event as Record<string, unknown>,
  };
}

function extractTrackingData(
  response: CJTrackingApiResponse
): CJTrackingDataResponse | undefined {
  if (Array.isArray(response.data)) {
    return response.data[0];
  }

  return response.data;
}

export function mapCJTrackingResponse(input: {
  externalOrderId: string;
  response: CJTrackingApiResponse;
}): SupplierTrackingResult {
  const data = extractTrackingData(input.response);
  const trackingNumber =
    data?.trackingNumber || data?.trackingNo || data?.logisticTrackingNumber;
  const carrierName =
    data?.carrierName || data?.logisticName || data?.logisticsName;
  const carrierCode = data?.carrierCode || data?.logisticCode;
  const rawEvents = data?.events || data?.trackingEvents || data?.trackings || [];
  const events = rawEvents
    .map(mapTrackingEvent)
    .sort((a, b) => new Date(a.eventAt).getTime() - new Date(b.eventAt).getTime());
  const latestEvent = events.at(-1);
  const rawStatus = data?.trackingStatus || data?.status || latestEvent?.rawStatus;
  const status =
    latestEvent && latestEvent.status !== "UNKNOWN"
      ? latestEvent.status
      : mapCJTrackingStatus(rawStatus);
  const success =
    input.response.success === true ||
    input.response.result === true ||
    input.response.code === 200;

  return {
    success,
    externalOrderId: input.externalOrderId,
    trackingNumber,
    trackingUrl: data?.trackingUrl,
    carrierCode,
    carrierName,
    status,
    events,
    shippedAt: data?.shippedAt || data?.shippedDate,
    deliveredAt: data?.deliveredAt || data?.deliveredDate,
    requestId: input.response.requestId,
    checkedAt: new Date().toISOString(),
    retryable:
      input.response.code === 429 ||
      Boolean(input.response.code && input.response.code >= 500),
    message: input.response.message,
    raw: input.response as Record<string, unknown>,
  };
}
