import "server-only";

import type { TenantContext } from "@/context/storeContext";
import { tenantColumns } from "@/context/storeContext";
import { redactSensitiveData } from "@/security/redactSensitiveData";
import { supabaseAdmin } from "@/services/supabase/admin";
import type {
  DeliveryEvent,
  DeliveryEventInput,
  FulfilmentUpdate,
  FulfilmentUpdateInput,
  ShipmentTracking,
  ShipmentTrackingInput,
  TrackingEvent,
  TrackingEventInput,
} from "@/tracking/types";

type ShipmentTrackingRow = {
  id: string;
  organisation_id: string;
  store_id: string;
  order_id: string;
  supplier_order_id: string | null;
  provider: string;
  tracking_key: string;
  status: ShipmentTracking["status"];
  tracking_number: string | null;
  courier: string | null;
  tracking_url: string | null;
  shipped_at: string | null;
  delivered_at: string | null;
  last_sync_at: string | null;
  last_event_at: string | null;
  last_event_summary: string | null;
  raw_data: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
};

type TrackingEventRow = {
  id: string;
  organisation_id: string;
  store_id: string;
  shipment_tracking_id: string;
  provider: string;
  dedupe_key: string;
  external_event_id: string | null;
  event_code: string | null;
  status: TrackingEvent["status"];
  summary: string;
  details: string | null;
  location: string | null;
  occurred_at: string;
  raw_data: Record<string, unknown> | null;
  created_at: string;
};

type FulfilmentUpdateRow = {
  id: string;
  organisation_id: string;
  store_id: string;
  order_id: string;
  shipment_tracking_id: string | null;
  provider: string;
  dedupe_key: string;
  external_fulfilment_id: string | null;
  status: FulfilmentUpdate["status"];
  request_payload: Record<string, unknown> | null;
  response_payload: Record<string, unknown> | null;
  error_message: string | null;
  processed_at: string | null;
  created_at: string;
};

type DeliveryEventRow = {
  id: string;
  organisation_id: string;
  store_id: string;
  order_id: string;
  shipment_tracking_id: string;
  dedupe_key: string;
  event_type: DeliveryEvent["eventType"];
  status: string | null;
  message: string | null;
  occurred_at: string;
  raw_data: Record<string, unknown> | null;
  created_at: string;
};

function mapShipmentTracking(row: ShipmentTrackingRow): ShipmentTracking {
  return {
    id: row.id,
    organisationId: row.organisation_id,
    storeId: row.store_id,
    orderId: row.order_id,
    supplierOrderId: row.supplier_order_id || undefined,
    provider: row.provider,
    trackingKey: row.tracking_key,
    status: row.status,
    trackingNumber: row.tracking_number || undefined,
    courier: row.courier || undefined,
    trackingUrl: row.tracking_url || undefined,
    shippedAt: row.shipped_at || undefined,
    deliveredAt: row.delivered_at || undefined,
    lastSyncAt: row.last_sync_at || undefined,
    lastEventAt: row.last_event_at || undefined,
    lastEventSummary: row.last_event_summary || undefined,
    rawData: row.raw_data || {},
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapTrackingEvent(row: TrackingEventRow): TrackingEvent {
  return {
    id: row.id,
    organisationId: row.organisation_id,
    storeId: row.store_id,
    shipmentTrackingId: row.shipment_tracking_id,
    provider: row.provider,
    dedupeKey: row.dedupe_key,
    externalEventId: row.external_event_id || undefined,
    eventCode: row.event_code || undefined,
    status: row.status,
    summary: row.summary,
    details: row.details || undefined,
    location: row.location || undefined,
    occurredAt: row.occurred_at,
    rawData: row.raw_data || {},
    createdAt: row.created_at,
  };
}

function mapFulfilmentUpdate(row: FulfilmentUpdateRow): FulfilmentUpdate {
  return {
    id: row.id,
    organisationId: row.organisation_id,
    storeId: row.store_id,
    orderId: row.order_id,
    shipmentTrackingId: row.shipment_tracking_id || undefined,
    provider: row.provider,
    dedupeKey: row.dedupe_key,
    externalFulfilmentId: row.external_fulfilment_id || undefined,
    status: row.status,
    requestPayload: row.request_payload || {},
    responsePayload: row.response_payload || {},
    errorMessage: row.error_message || undefined,
    processedAt: row.processed_at || undefined,
    createdAt: row.created_at,
  };
}

function mapDeliveryEvent(row: DeliveryEventRow): DeliveryEvent {
  return {
    id: row.id,
    organisationId: row.organisation_id,
    storeId: row.store_id,
    orderId: row.order_id,
    shipmentTrackingId: row.shipment_tracking_id,
    dedupeKey: row.dedupe_key,
    eventType: row.event_type,
    status: row.status || undefined,
    message: row.message || undefined,
    occurredAt: row.occurred_at,
    rawData: row.raw_data || {},
    createdAt: row.created_at,
  };
}

function compactText(value?: string) {
  return (value || "").trim().toLowerCase();
}

function safeToken(value?: string) {
  return compactText(value).replace(/[^a-z0-9_-]+/g, "-");
}

export function buildShipmentTrackingKey(input: {
  orderId: string;
  supplierOrderId?: string;
  provider: string;
  trackingNumber?: string;
}) {
  const provider = safeToken(input.provider) || "unknown";
  const supplierOrderId = compactText(input.supplierOrderId);
  const trackingNumber = safeToken(input.trackingNumber);

  if (supplierOrderId) {
    return `${provider}:supplier:${supplierOrderId}`;
  }

  if (trackingNumber) {
    return `${provider}:order:${input.orderId}:tracking:${trackingNumber}`;
  }

  return `${provider}:order:${input.orderId}:pending`;
}

export function buildTrackingEventDedupeKey(input: {
  shipmentTrackingId: string;
  externalEventId?: string;
  eventCode?: string;
  status: string;
  occurredAt: string;
  summary: string;
}) {
  const externalEventId = compactText(input.externalEventId);

  if (externalEventId) {
    return `tracking:${input.shipmentTrackingId}:external:${externalEventId}`;
  }

  return [
    "tracking",
    input.shipmentTrackingId,
    safeToken(input.eventCode) || safeToken(input.status) || "unknown",
    input.occurredAt,
    safeToken(input.summary) || "event",
  ].join(":");
}

export function buildFulfilmentUpdateDedupeKey(input: {
  orderId: string;
  provider: string;
  externalFulfilmentId?: string;
  status: string;
  shipmentTrackingId?: string;
  processedAt?: string;
}) {
  const externalId = compactText(input.externalFulfilmentId);

  if (externalId) {
    return `fulfilment:${safeToken(input.provider)}:${input.orderId}:${externalId}`;
  }

  return [
    "fulfilment",
    safeToken(input.provider) || "unknown",
    input.orderId,
    input.shipmentTrackingId || "no-shipment",
    safeToken(input.status) || "unknown",
    input.processedAt || "pending",
  ].join(":");
}

export function buildDeliveryEventDedupeKey(input: {
  shipmentTrackingId: string;
  eventType: string;
  occurredAt: string;
  message?: string;
}) {
  return [
    "delivery",
    input.shipmentTrackingId,
    safeToken(input.eventType) || "unknown",
    input.occurredAt,
    safeToken(input.message) || "event",
  ].join(":");
}

export async function saveShipmentTracking(input: {
  context: TenantContext;
  shipment: ShipmentTrackingInput;
}): Promise<ShipmentTracking> {
  const trackingKey = buildShipmentTrackingKey({
    orderId: input.shipment.orderId,
    supplierOrderId: input.shipment.supplierOrderId,
    provider: input.shipment.provider,
    trackingNumber: input.shipment.trackingNumber,
  });

  const { data, error } = await supabaseAdmin
    .from("shipment_tracking")
    .upsert(
      {
        ...tenantColumns(input.context),
        order_id: input.shipment.orderId,
        supplier_order_id: input.shipment.supplierOrderId || null,
        provider: input.shipment.provider,
        tracking_key: trackingKey,
        status: input.shipment.status,
        tracking_number: input.shipment.trackingNumber || null,
        courier: input.shipment.courier || null,
        tracking_url: input.shipment.trackingUrl || null,
        shipped_at: input.shipment.shippedAt || null,
        delivered_at: input.shipment.deliveredAt || null,
        last_sync_at: input.shipment.lastSyncAt || null,
        last_event_at: input.shipment.lastEventAt || null,
        last_event_summary: input.shipment.lastEventSummary || null,
        raw_data: redactSensitiveData(input.shipment.rawData || {}),
        updated_at: new Date().toISOString(),
      },
      {
        onConflict: "store_id,tracking_key",
      }
    )
    .select("*")
    .single<ShipmentTrackingRow>();

  if (error || !data) {
    throw new Error(
      `Failed to save shipment tracking: ${error?.message || "Unknown error"}`
    );
  }

  return mapShipmentTracking(data);
}

export async function saveTrackingEvents(input: {
  context: TenantContext;
  events: TrackingEventInput[];
}): Promise<TrackingEvent[]> {
  if (!input.events.length) return [];

  const rows = input.events.map((event) => ({
    ...tenantColumns(input.context),
    shipment_tracking_id: event.shipmentTrackingId,
    provider: event.provider,
    dedupe_key: buildTrackingEventDedupeKey({
      shipmentTrackingId: event.shipmentTrackingId,
      externalEventId: event.externalEventId,
      eventCode: event.eventCode,
      status: event.status,
      occurredAt: event.occurredAt,
      summary: event.summary,
    }),
    external_event_id: event.externalEventId || null,
    event_code: event.eventCode || null,
    status: event.status,
    summary: event.summary,
    details: event.details || null,
    location: event.location || null,
    occurred_at: event.occurredAt,
    raw_data: redactSensitiveData(event.rawData || {}),
  }));

  const { data, error } = await supabaseAdmin
    .from("tracking_events")
    .upsert(rows, { onConflict: "store_id,dedupe_key" })
    .select("*");

  if (error) {
    throw new Error(`Failed to save tracking events: ${error.message}`);
  }

  return ((data || []) as TrackingEventRow[]).map(mapTrackingEvent);
}

export async function saveFulfilmentUpdate(input: {
  context: TenantContext;
  update: FulfilmentUpdateInput;
}): Promise<FulfilmentUpdate> {
  const dedupeKey = buildFulfilmentUpdateDedupeKey({
    orderId: input.update.orderId,
    provider: input.update.provider,
    externalFulfilmentId: input.update.externalFulfilmentId,
    status: input.update.status,
    shipmentTrackingId: input.update.shipmentTrackingId,
    processedAt: input.update.processedAt,
  });

  const { data, error } = await supabaseAdmin
    .from("fulfilment_updates")
    .upsert(
      {
        ...tenantColumns(input.context),
        order_id: input.update.orderId,
        shipment_tracking_id: input.update.shipmentTrackingId || null,
        provider: input.update.provider,
        dedupe_key: dedupeKey,
        external_fulfilment_id: input.update.externalFulfilmentId || null,
        status: input.update.status,
        request_payload: redactSensitiveData(input.update.requestPayload || {}),
        response_payload: redactSensitiveData(input.update.responsePayload || {}),
        error_message: input.update.errorMessage || null,
        processed_at: input.update.processedAt || null,
      },
      { onConflict: "store_id,dedupe_key" }
    )
    .select("*")
    .single<FulfilmentUpdateRow>();

  if (error || !data) {
    throw new Error(
      `Failed to save fulfilment update: ${error?.message || "Unknown error"}`
    );
  }

  return mapFulfilmentUpdate(data);
}

export async function saveDeliveryEvent(input: {
  context: TenantContext;
  event: DeliveryEventInput;
}): Promise<DeliveryEvent> {
  const dedupeKey = buildDeliveryEventDedupeKey({
    shipmentTrackingId: input.event.shipmentTrackingId,
    eventType: input.event.eventType,
    occurredAt: input.event.occurredAt,
    message: input.event.message,
  });

  const { data, error } = await supabaseAdmin
    .from("delivery_events")
    .upsert(
      {
        ...tenantColumns(input.context),
        order_id: input.event.orderId,
        shipment_tracking_id: input.event.shipmentTrackingId,
        dedupe_key: dedupeKey,
        event_type: input.event.eventType,
        status: input.event.status || null,
        message: input.event.message || null,
        occurred_at: input.event.occurredAt,
        raw_data: redactSensitiveData(input.event.rawData || {}),
      },
      { onConflict: "store_id,dedupe_key" }
    )
    .select("*")
    .single<DeliveryEventRow>();

  if (error || !data) {
    throw new Error(
      `Failed to save delivery event: ${error?.message || "Unknown error"}`
    );
  }

  return mapDeliveryEvent(data);
}

export async function getShipmentTrackingForOrder(
  context: TenantContext,
  orderId: string
): Promise<ShipmentTracking[]> {
  const { data, error } = await supabaseAdmin
    .from("shipment_tracking")
    .select("*")
    .eq("organisation_id", context.organisationId)
    .eq("store_id", context.storeId)
    .eq("order_id", orderId)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(`Failed to load shipment tracking: ${error.message}`);
  }

  return ((data || []) as ShipmentTrackingRow[]).map(mapShipmentTracking);
}

export async function getShipmentTrackingById(
  context: TenantContext,
  shipmentTrackingId: string
): Promise<ShipmentTracking | null> {
  const { data, error } = await supabaseAdmin
    .from("shipment_tracking")
    .select("*")
    .eq("organisation_id", context.organisationId)
    .eq("store_id", context.storeId)
    .eq("id", shipmentTrackingId)
    .maybeSingle<ShipmentTrackingRow>();

  if (error) {
    throw new Error(`Failed to load shipment tracking: ${error.message}`);
  }

  return data ? mapShipmentTracking(data) : null;
}

export async function listTrackingEvents(
  context: TenantContext,
  shipmentTrackingId: string
): Promise<TrackingEvent[]> {
  const { data, error } = await supabaseAdmin
    .from("tracking_events")
    .select("*")
    .eq("organisation_id", context.organisationId)
    .eq("store_id", context.storeId)
    .eq("shipment_tracking_id", shipmentTrackingId)
    .order("occurred_at", { ascending: false });

  if (error) {
    throw new Error(`Failed to load tracking events: ${error.message}`);
  }

  return ((data || []) as TrackingEventRow[]).map(mapTrackingEvent);
}

export async function listFulfilmentUpdatesForOrder(
  context: TenantContext,
  orderId: string
): Promise<FulfilmentUpdate[]> {
  const { data, error } = await supabaseAdmin
    .from("fulfilment_updates")
    .select("*")
    .eq("organisation_id", context.organisationId)
    .eq("store_id", context.storeId)
    .eq("order_id", orderId)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(`Failed to load fulfilment updates: ${error.message}`);
  }

  return ((data || []) as FulfilmentUpdateRow[]).map(mapFulfilmentUpdate);
}

export async function listDeliveryEventsForOrder(
  context: TenantContext,
  orderId: string
): Promise<DeliveryEvent[]> {
  const { data, error } = await supabaseAdmin
    .from("delivery_events")
    .select("*")
    .eq("organisation_id", context.organisationId)
    .eq("store_id", context.storeId)
    .eq("order_id", orderId)
    .order("occurred_at", { ascending: false });

  if (error) {
    throw new Error(`Failed to load delivery events: ${error.message}`);
  }

  return ((data || []) as DeliveryEventRow[]).map(mapDeliveryEvent);
}
