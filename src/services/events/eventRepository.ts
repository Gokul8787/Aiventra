import "server-only";

import { supabaseAdmin } from "@/services/supabase/admin";
import { DomainEvent, DomainEventType } from "@/events/types";
import type { TenantContext } from "@/context/storeContext";
import { tenantColumns, tenantPayload } from "@/context/storeContext";

type EventRow = {
  id: string;
  organisation_id: string | null;
  store_id: string | null;
  event_type: DomainEventType;
  aggregate_type: string;
  aggregate_id: string;
  payload: Record<string, unknown>;
  metadata: Record<string, unknown>;
  attempts: number;
  max_attempts: number;
  created_at: string;
};

function mapEvent(row: EventRow): DomainEvent {
  const metadata = row.metadata || {};
  const contextMetadata =
    typeof metadata.tenantContext === "object" && metadata.tenantContext !== null
      ? (metadata.tenantContext as Partial<TenantContext>)
      : {};

  return {
    id: row.id,
    tenantContext: {
      organisationId: row.organisation_id || contextMetadata.organisationId || "",
      storeId: row.store_id || contextMetadata.storeId || "",
      userId: contextMetadata.userId,
      timezone: contextMetadata.timezone || "Europe/London",
      currency: contextMetadata.currency || "GBP",
      locale: contextMetadata.locale || "en-GB",
      organisationName: contextMetadata.organisationName,
      storeName: contextMetadata.storeName,
    },
    eventType: row.event_type,
    aggregateType: row.aggregate_type,
    aggregateId: row.aggregate_id,
    payload: row.payload || {},
    metadata: row.metadata || {},
    attempts: row.attempts,
    maxAttempts: row.max_attempts,
    createdAt: row.created_at,
  };
}

export async function publishEvent(input: {
  tenantContext: TenantContext;
  eventType: DomainEventType;
  aggregateType: string;
  aggregateId: string;
  payload?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  availableAt?: string;
}): Promise<string> {
  const metadata = {
    ...(input.metadata || {}),
    tenantContext: tenantPayload(input.tenantContext),
  };

  const { data, error } = await supabaseAdmin
    .from("domain_events")
    .insert({
      ...tenantColumns(input.tenantContext),
      event_type: input.eventType,
      aggregate_type: input.aggregateType,
      aggregate_id: input.aggregateId,
      payload: input.payload || {},
      metadata,
      available_at: input.availableAt || new Date().toISOString(),
      status: "pending",
    })
    .select("id")
    .single();

  if (error || !data) {
    throw new Error(
      `Failed to publish event: ${error?.message || "No event returned"}`
    );
  }

  return data.id;
}

export async function claimPendingEvents(input: {
  workerId: string;
  limit?: number;
}): Promise<DomainEvent[]> {
  const limit = input.limit ?? 10;

  const { data, error } = await supabaseAdmin
    .from("domain_events")
    .select("*")
    .eq("status", "pending")
    .lte("available_at", new Date().toISOString())
    .order("created_at", { ascending: true })
    .limit(limit);

  if (error) {
    throw new Error(`Failed to load pending events: ${error.message}`);
  }

  const rows = (data || []) as EventRow[];
  const claimed: DomainEvent[] = [];

  for (const row of rows) {
    const { data: updated, error: updateError } = await supabaseAdmin
      .from("domain_events")
      .update({
        status: "processing",
        locked_at: new Date().toISOString(),
        locked_by: input.workerId,
        attempts: row.attempts + 1,
      })
      .eq("id", row.id)
      .eq("status", "pending")
      .select("*")
      .maybeSingle();

    if (!updateError && updated) {
      claimed.push(mapEvent(updated as EventRow));
    }
  }

  return claimed;
}

export async function completeEvent(eventId: string): Promise<void> {
  const { error } = await supabaseAdmin
    .from("domain_events")
    .update({
      status: "completed",
      processed_at: new Date().toISOString(),
      locked_at: null,
      locked_by: null,
    })
    .eq("id", eventId);

  if (error) {
    throw new Error(`Failed to complete event: ${error.message}`);
  }
}

export async function failEvent(
  event: DomainEvent,
  errorMessage: string
): Promise<void> {
  const exhausted = event.attempts >= event.maxAttempts;
  const retryDelaySeconds = Math.min(60 * 2 ** event.attempts, 3600);
  const availableAt = new Date(
    Date.now() + retryDelaySeconds * 1000
  ).toISOString();

  const { error } = await supabaseAdmin
    .from("domain_events")
    .update({
      status: exhausted ? "dead_letter" : "pending",
      last_error: errorMessage,
      available_at: availableAt,
      locked_at: null,
      locked_by: null,
    })
    .eq("id", event.id);

  if (error) {
    console.error("Failed to mark event failure:", error.message);
  }
}

export async function startEventDelivery(
  eventId: string,
  handlerName: string,
  tenantContext: TenantContext
): Promise<void> {
  const { error } = await supabaseAdmin.from("event_deliveries").upsert(
    {
      ...tenantColumns(tenantContext),
      event_id: eventId,
      handler_name: handlerName,
      status: "started",
      started_at: new Date().toISOString(),
      completed_at: null,
      error_message: null,
    },
    {
      onConflict: "event_id,handler_name",
    }
  );

  if (error) {
    throw new Error(`Failed to start event delivery: ${error.message}`);
  }
}

export async function completeEventDelivery(
  eventId: string,
  handlerName: string
): Promise<void> {
  const { error } = await supabaseAdmin
    .from("event_deliveries")
    .update({
      status: "completed",
      completed_at: new Date().toISOString(),
      error_message: null,
    })
    .eq("event_id", eventId)
    .eq("handler_name", handlerName);

  if (error) {
    throw new Error(`Failed to complete event delivery: ${error.message}`);
  }
}

export async function failEventDelivery(
  eventId: string,
  handlerName: string,
  errorMessage: string
): Promise<void> {
  const { error } = await supabaseAdmin
    .from("event_deliveries")
    .update({
      status: "failed",
      completed_at: new Date().toISOString(),
      error_message: errorMessage,
    })
    .eq("event_id", eventId)
    .eq("handler_name", handlerName);

  if (error) {
    console.error("Failed to fail event delivery:", error.message);
  }
}
