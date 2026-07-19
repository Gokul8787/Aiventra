import "server-only";

import type { CancellationStatus } from "@/recovery/types";
import { supabaseAdmin } from "@/services/supabase/admin";

export async function createCancellationRequest(input: {
  organisationId: string;
  storeId: string;
  orderId: string;
  source: "shopify" | "customer" | "operator" | "automation";
  reason?: string;
  requestedBy?: string;
  metadata?: Record<string, unknown>;
}) {
  const idempotencyKey = [
    input.storeId,
    input.orderId,
    "order-cancellation",
  ].join(":");

  const { data, error } = await supabaseAdmin
    .from("cancellation_requests")
    .upsert(
      {
        organisation_id: input.organisationId,
        store_id: input.storeId,
        order_id: input.orderId,
        source: input.source,
        status: "requested",
        reason: input.reason ?? null,
        requested_by: input.requestedBy ?? null,
        idempotency_key: idempotencyKey,
        metadata: input.metadata ?? {},
        updated_at: new Date().toISOString(),
      },
      {
        onConflict: "idempotency_key",
      }
    )
    .select("*")
    .single();

  if (error || !data) {
    throw new Error(
      `Failed to create cancellation request: ${
        error?.message ?? "No cancellation row returned."
      }`
    );
  }

  return data;
}

export async function getCancellationRequestById(input: {
  organisationId: string;
  storeId: string;
  cancellationRequestId: string;
}) {
  const { data, error } = await supabaseAdmin
    .from("cancellation_requests")
    .select("*")
    .eq("organisation_id", input.organisationId)
    .eq("store_id", input.storeId)
    .eq("id", input.cancellationRequestId)
    .maybeSingle();

  if (error) {
    throw new Error(
      `Failed to load cancellation request: ${error.message}`
    );
  }

  return data;
}

export async function getLatestCancellationRequestForOrder(input: {
  organisationId: string;
  storeId: string;
  orderId: string;
}) {
  const { data, error } = await supabaseAdmin
    .from("cancellation_requests")
    .select("*")
    .eq("organisation_id", input.organisationId)
    .eq("store_id", input.storeId)
    .eq("order_id", input.orderId)
    .order("requested_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(
      `Failed to load latest cancellation request: ${error.message}`
    );
  }

  return data;
}

export async function listCancellationRequestsForOrder(input: {
  organisationId: string;
  storeId: string;
  orderId: string;
}) {
  const { data, error } = await supabaseAdmin
    .from("cancellation_requests")
    .select("*")
    .eq("organisation_id", input.organisationId)
    .eq("store_id", input.storeId)
    .eq("order_id", input.orderId)
    .order("requested_at", { ascending: false });

  if (error) {
    throw new Error(
      `Failed to load cancellation requests: ${error.message}`
    );
  }

  return data || [];
}

export async function updateCancellationRequest(input: {
  cancellationRequestId: string;
  status: CancellationStatus;
  supplierOrderId?: string;
  platformFulfilmentId?: string;
  blockers?: string[];
  warnings?: string[];
  decision?: string;
  confidence?: number;
  decisionReasons?: Array<Record<string, unknown>>;
  attemptCount?: number;
  maxAttempts?: number;
  nextRetryAt?: string | null;
  lastError?: string | null;
  processingStartedAt?: string | null;
  processingCompletedAt?: string | null;
  metadata?: Record<string, unknown>;
  completed?: boolean;
}): Promise<void> {
  const { error } = await supabaseAdmin
    .from("cancellation_requests")
    .update({
      status: input.status,
      supplier_order_id: input.supplierOrderId ?? undefined,
      platform_fulfilment_id: input.platformFulfilmentId ?? undefined,
      blockers: input.blockers ?? undefined,
      warnings: input.warnings ?? undefined,
      decision: input.decision ?? undefined,
      confidence: input.confidence ?? undefined,
      decision_reasons: input.decisionReasons ?? undefined,
      attempt_count: input.attemptCount ?? undefined,
      max_attempts: input.maxAttempts ?? undefined,
      next_retry_at:
        input.nextRetryAt === undefined ? undefined : input.nextRetryAt,
      last_error: input.lastError === undefined ? undefined : input.lastError,
      processing_started_at:
        input.processingStartedAt === undefined
          ? undefined
          : input.processingStartedAt,
      processing_completed_at:
        input.processingCompletedAt === undefined
          ? undefined
          : input.processingCompletedAt,
      metadata: input.metadata ?? undefined,
      completed_at: input.completed ? new Date().toISOString() : undefined,
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.cancellationRequestId);

  if (error) {
    throw new Error(
      `Failed to update cancellation request: ${error.message}`
    );
  }
}
