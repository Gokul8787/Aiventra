import "server-only";

import type { TenantContext } from "@/context/storeContext";
import { tenantColumns } from "@/context/storeContext";
import { redactSensitiveData } from "@/security/redactSensitiveData";
import { supabaseAdmin } from "@/services/supabase/admin";

export type PlatformFulfilmentRecord = {
  id: string;
  organisationId: string;
  storeId: string;
  orderId: string;
  shipmentTrackingId: string;
  supplierOrderId?: string;
  platform: string;
  externalFulfilmentId?: string;
  externalOrderId?: string;
  externalFulfilmentOrderIds: string[];
  trackingNumber?: string;
  trackingUrl?: string;
  carrier?: string;
  status: "pending" | "submitted" | "fulfilled" | "failed" | "cancelled";
  customerNotified: boolean;
  errorMessage?: string;
  rawResponse: Record<string, unknown>;
  fulfilledAt?: string;
  createdAt: string;
  updatedAt: string;
};

export type PlatformFulfilmentEventRecord = {
  id: string;
  platformFulfilmentId: string;
  dedupeKey: string;
  eventType: string;
  status?: string;
  message?: string;
  payload: Record<string, unknown>;
  createdAt: string;
};

type PlatformFulfilmentRow = {
  id: string;
  organisation_id: string;
  store_id: string;
  order_id: string;
  shipment_tracking_id: string;
  supplier_order_id: string | null;
  platform: string;
  external_fulfilment_id: string | null;
  external_order_id: string | null;
  external_fulfilment_order_ids: string[] | null;
  tracking_number: string | null;
  tracking_url: string | null;
  carrier: string | null;
  status: PlatformFulfilmentRecord["status"];
  customer_notified: boolean;
  error_message: string | null;
  raw_response: Record<string, unknown> | null;
  fulfilled_at: string | null;
  created_at: string;
  updated_at: string;
};

type PlatformFulfilmentEventRow = {
  id: string;
  platform_fulfilment_id: string;
  dedupe_key: string;
  event_type: string;
  status: string | null;
  message: string | null;
  payload: Record<string, unknown> | null;
  created_at: string;
};

function mapPlatformFulfilment(row: PlatformFulfilmentRow): PlatformFulfilmentRecord {
  return {
    id: row.id,
    organisationId: row.organisation_id,
    storeId: row.store_id,
    orderId: row.order_id,
    shipmentTrackingId: row.shipment_tracking_id,
    supplierOrderId: row.supplier_order_id || undefined,
    platform: row.platform,
    externalFulfilmentId: row.external_fulfilment_id || undefined,
    externalOrderId: row.external_order_id || undefined,
    externalFulfilmentOrderIds: row.external_fulfilment_order_ids || [],
    trackingNumber: row.tracking_number || undefined,
    trackingUrl: row.tracking_url || undefined,
    carrier: row.carrier || undefined,
    status: row.status,
    customerNotified: row.customer_notified,
    errorMessage: row.error_message || undefined,
    rawResponse: row.raw_response || {},
    fulfilledAt: row.fulfilled_at || undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapPlatformFulfilmentEvent(
  row: PlatformFulfilmentEventRow
): PlatformFulfilmentEventRecord {
  return {
    id: row.id,
    platformFulfilmentId: row.platform_fulfilment_id,
    dedupeKey: row.dedupe_key,
    eventType: row.event_type,
    status: row.status || undefined,
    message: row.message || undefined,
    payload: row.payload || {},
    createdAt: row.created_at,
  };
}

function safeToken(value?: string) {
  return (value || "").trim().toLowerCase().replace(/[^a-z0-9_-]+/g, "-");
}

export function buildPlatformFulfilmentEventDedupeKey(input: {
  platformFulfilmentId: string;
  eventType: string;
  status?: string;
  dedupeScope?: string;
}) {
  return [
    "platform-fulfilment",
    input.platformFulfilmentId,
    safeToken(input.eventType) || "event",
    safeToken(input.status) || "status",
    safeToken(input.dedupeScope) || "default",
  ].join(":");
}

export async function upsertPlatformFulfilment(input: {
  tenantContext: TenantContext;
  orderId: string;
  shipmentTrackingId: string;
  supplierOrderId?: string;
  platform: string;
  externalFulfilmentId?: string;
  externalOrderId?: string;
  externalFulfilmentOrderIds?: string[];
  trackingNumber?: string;
  trackingUrl?: string;
  carrier?: string;
  status: PlatformFulfilmentRecord["status"];
  customerNotified: boolean;
  errorMessage?: string;
  rawResponse?: Record<string, unknown>;
  fulfilledAt?: string;
}): Promise<PlatformFulfilmentRecord> {
  const { data, error } = await supabaseAdmin
    .from("platform_fulfilments")
    .upsert(
      {
        ...tenantColumns(input.tenantContext),
        order_id: input.orderId,
        shipment_tracking_id: input.shipmentTrackingId,
        supplier_order_id: input.supplierOrderId || null,
        platform: input.platform,
        external_fulfilment_id: input.externalFulfilmentId || null,
        external_order_id: input.externalOrderId || null,
        external_fulfilment_order_ids: input.externalFulfilmentOrderIds || [],
        tracking_number: input.trackingNumber || null,
        tracking_url: input.trackingUrl || null,
        carrier: input.carrier || null,
        status: input.status,
        customer_notified: input.customerNotified,
        error_message: input.errorMessage || null,
        raw_response: redactSensitiveData(input.rawResponse || {}),
        fulfilled_at: input.fulfilledAt || null,
        updated_at: new Date().toISOString(),
      },
      {
        onConflict: "store_id,platform,shipment_tracking_id",
      }
    )
    .select("*")
    .single<PlatformFulfilmentRow>();

  if (error || !data) {
    throw new Error(
      `Failed to save platform fulfilment: ${error?.message || "Unknown error"}`
    );
  }

  return mapPlatformFulfilment(data);
}

export async function getPlatformFulfilmentByShipment(input: {
  tenantContext: TenantContext;
  shipmentTrackingId: string;
  platform: string;
}): Promise<PlatformFulfilmentRecord | null> {
  const { data, error } = await supabaseAdmin
    .from("platform_fulfilments")
    .select("*")
    .eq("organisation_id", input.tenantContext.organisationId)
    .eq("store_id", input.tenantContext.storeId)
    .eq("shipment_tracking_id", input.shipmentTrackingId)
    .eq("platform", input.platform)
    .maybeSingle<PlatformFulfilmentRow>();

  if (error) {
    throw new Error(`Failed to load platform fulfilment: ${error.message}`);
  }

  return data ? mapPlatformFulfilment(data) : null;
}

export async function listPlatformFulfilmentsForOrder(
  tenantContext: TenantContext,
  orderId: string
): Promise<PlatformFulfilmentRecord[]> {
  const { data, error } = await supabaseAdmin
    .from("platform_fulfilments")
    .select("*")
    .eq("organisation_id", tenantContext.organisationId)
    .eq("store_id", tenantContext.storeId)
    .eq("order_id", orderId)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(`Failed to load platform fulfilments: ${error.message}`);
  }

  return ((data || []) as PlatformFulfilmentRow[]).map(mapPlatformFulfilment);
}

export async function appendPlatformFulfilmentEvent(input: {
  tenantContext: TenantContext;
  platformFulfilmentId: string;
  eventType: string;
  status?: string;
  message?: string;
  dedupeScope?: string;
  payload?: Record<string, unknown>;
}): Promise<PlatformFulfilmentEventRecord> {
  const dedupeKey = buildPlatformFulfilmentEventDedupeKey({
    platformFulfilmentId: input.platformFulfilmentId,
    eventType: input.eventType,
    status: input.status,
    dedupeScope: input.dedupeScope,
  });

  const { data, error } = await supabaseAdmin
    .from("platform_fulfilment_events")
    .upsert(
      {
        ...tenantColumns(input.tenantContext),
        platform_fulfilment_id: input.platformFulfilmentId,
        dedupe_key: dedupeKey,
        event_type: input.eventType,
        status: input.status || null,
        message: input.message || null,
        payload: redactSensitiveData(input.payload || {}),
      },
      {
        onConflict: "store_id,dedupe_key",
      }
    )
    .select("*")
    .single<PlatformFulfilmentEventRow>();

  if (error || !data) {
    throw new Error(
      `Failed to append platform fulfilment event: ${
        error?.message || "Unknown error"
      }`
    );
  }

  return mapPlatformFulfilmentEvent(data);
}

export async function listPlatformFulfilmentEvents(input: {
  tenantContext: TenantContext;
  platformFulfilmentId: string;
}): Promise<PlatformFulfilmentEventRecord[]> {
  const { data, error } = await supabaseAdmin
    .from("platform_fulfilment_events")
    .select("*")
    .eq("organisation_id", input.tenantContext.organisationId)
    .eq("store_id", input.tenantContext.storeId)
    .eq("platform_fulfilment_id", input.platformFulfilmentId)
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error(`Failed to load platform fulfilment events: ${error.message}`);
  }

  return ((data || []) as PlatformFulfilmentEventRow[]).map(
    mapPlatformFulfilmentEvent
  );
}
