import "server-only";

import type { RecoveryAnalysis } from "@/recovery/types";
import { supabaseAdmin } from "@/services/supabase/admin";

export type DeadLetterItemRecord = {
  id: string;
  organisationId: string;
  storeId: string;
  sourceQueue: string;
  jobId?: string;
  cancellationRequestId?: string;
  jobType: string;
  payload: Record<string, unknown>;
  errorCode?: string;
  errorMessage?: string;
  attemptCount: number;
  maxAttempts: number;
  status: "open" | "requeued" | "resolved" | "ignored";
  idempotencyKey: string;
  createdAt: string;
  requeuedAt?: string;
  resolvedAt?: string;
};

type DeadLetterItemRow = {
  id: string;
  organisation_id: string;
  store_id: string;
  source_queue: string;
  job_id: string | null;
  cancellation_request_id: string | null;
  job_type: string;
  payload: Record<string, unknown> | null;
  error_code: string | null;
  error_message: string | null;
  attempt_count: number | string;
  max_attempts: number | string;
  status: DeadLetterItemRecord["status"];
  idempotency_key: string;
  created_at: string;
  requeued_at: string | null;
  resolved_at: string | null;
};

function mapDeadLetterItem(row: DeadLetterItemRow): DeadLetterItemRecord {
  return {
    id: row.id,
    organisationId: row.organisation_id,
    storeId: row.store_id,
    sourceQueue: row.source_queue,
    jobId: row.job_id || undefined,
    cancellationRequestId: row.cancellation_request_id || undefined,
    jobType: row.job_type,
    payload: row.payload || {},
    errorCode: row.error_code || undefined,
    errorMessage: row.error_message || undefined,
    attemptCount: Number(row.attempt_count || 0),
    maxAttempts: Number(row.max_attempts || 0),
    status: row.status,
    idempotencyKey: row.idempotency_key,
    createdAt: row.created_at,
    requeuedAt: row.requeued_at || undefined,
    resolvedAt: row.resolved_at || undefined,
  };
}

export async function saveRecoveryAnalysis(input: {
  cancellationRequestId: string;
  analysis: RecoveryAnalysis;
}): Promise<void> {
  const { error } = await supabaseAdmin
    .from("cancellation_requests")
    .update({
      status: "checking",
      decision: input.analysis.decision,
      confidence: input.analysis.confidence,
      decision_reasons: input.analysis.reasons,
      blockers: input.analysis.blockers,
      warnings: input.analysis.warnings,
      processing_started_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.cancellationRequestId);

  if (error) {
    throw new Error(`Failed to save recovery analysis: ${error.message}`);
  }
}

export async function startRecoveryAttempt(input: {
  organisationId: string;
  storeId: string;
  cancellationRequestId: string;
  attemptNumber: number;
  action: string;
}): Promise<string> {
  const { data, error } = await supabaseAdmin
    .from("recovery_attempts")
    .upsert(
      {
        organisation_id: input.organisationId,
        store_id: input.storeId,
        cancellation_request_id: input.cancellationRequestId,
        attempt_number: input.attemptNumber,
        action: input.action,
        status: "running",
      },
      {
        onConflict: "cancellation_request_id,attempt_number,action",
      }
    )
    .select("id")
    .single<{ id: string }>();

  if (error || !data) {
    throw new Error(
      `Failed to create recovery attempt: ${error?.message ?? "No row returned."}`
    );
  }

  return data.id;
}

export async function completeRecoveryAttempt(
  recoveryAttemptId: string
): Promise<void> {
  const { error } = await supabaseAdmin
    .from("recovery_attempts")
    .update({
      status: "completed",
      completed_at: new Date().toISOString(),
    })
    .eq("id", recoveryAttemptId);

  if (error) {
    throw new Error(`Failed to complete recovery attempt: ${error.message}`);
  }
}

export async function getRecoveryAttemptId(input: {
  cancellationRequestId: string;
  attemptNumber: number;
  action: string;
}): Promise<string | null> {
  const { data, error } = await supabaseAdmin
    .from("recovery_attempts")
    .select("id")
    .eq("cancellation_request_id", input.cancellationRequestId)
    .eq("attempt_number", input.attemptNumber)
    .eq("action", input.action)
    .maybeSingle<{ id: string }>();

  if (error) {
    throw new Error(`Failed to load recovery attempt: ${error.message}`);
  }

  return data?.id || null;
}

export async function failRecoveryAttempt(input: {
  recoveryAttemptId: string;
  status: "retrying" | "failed" | "dead_letter";
  retryable: boolean;
  errorCode?: string;
  errorMessage: string;
}): Promise<void> {
  const { error } = await supabaseAdmin
    .from("recovery_attempts")
    .update({
      status: input.status,
      retryable: input.retryable,
      error_code: input.errorCode ?? null,
      error_message: input.errorMessage,
      completed_at: new Date().toISOString(),
    })
    .eq("id", input.recoveryAttemptId);

  if (error) {
    throw new Error(`Failed to record recovery failure: ${error.message}`);
  }
}

export async function createDeadLetterItem(input: {
  organisationId: string;
  storeId: string;
  sourceQueue: string;
  jobId?: string;
  cancellationRequestId?: string;
  jobType: string;
  payload: Record<string, unknown>;
  errorCode?: string;
  errorMessage: string;
  attemptCount: number;
  maxAttempts: number;
  idempotencyKey: string;
}): Promise<string> {
  const { data, error } = await supabaseAdmin
    .from("dead_letter_items")
    .upsert(
      {
        organisation_id: input.organisationId,
        store_id: input.storeId,
        source_queue: input.sourceQueue,
        job_id: input.jobId ?? null,
        cancellation_request_id: input.cancellationRequestId ?? null,
        job_type: input.jobType,
        payload: input.payload,
        error_code: input.errorCode ?? null,
        error_message: input.errorMessage,
        attempt_count: input.attemptCount,
        max_attempts: input.maxAttempts,
        idempotency_key: input.idempotencyKey,
      },
      {
        onConflict: "idempotency_key",
      }
    )
    .select("id")
    .single<{ id: string }>();

  if (error || !data) {
    throw new Error(
      `Failed to create dead-letter item: ${error?.message ?? "No row returned."}`
    );
  }

  return data.id;
}

export async function getDeadLetterItemById(input: {
  organisationId: string;
  storeId: string;
  deadLetterItemId: string;
}): Promise<DeadLetterItemRecord | null> {
  const { data, error } = await supabaseAdmin
    .from("dead_letter_items")
    .select("*")
    .eq("organisation_id", input.organisationId)
    .eq("store_id", input.storeId)
    .eq("id", input.deadLetterItemId)
    .maybeSingle<DeadLetterItemRow>();

  if (error) {
    throw new Error(`Failed to load dead-letter item: ${error.message}`);
  }

  return data ? mapDeadLetterItem(data) : null;
}

export async function markDeadLetterItemRequeued(input: {
  deadLetterItemId: string;
  organisationId?: string;
  storeId?: string;
}): Promise<void> {
  let query = supabaseAdmin
    .from("dead_letter_items")
    .update({
      status: "requeued",
      requeued_at: new Date().toISOString(),
    })
    .eq("id", input.deadLetterItemId)
    .eq("status", "open");

  if (input.organisationId && input.storeId) {
    query = query
      .eq("organisation_id", input.organisationId)
      .eq("store_id", input.storeId);
  }

  const { error } = await query;

  if (error) {
    throw new Error(`Failed to requeue dead-letter item: ${error.message}`);
  }
}

export async function updateDeadLetterItemStatus(input: {
  deadLetterItemId: string;
  status: "resolved" | "ignored";
  organisationId?: string;
  storeId?: string;
}): Promise<void> {
  const updates: Record<string, unknown> = {
    status: input.status,
  };

  if (input.status === "resolved") {
    updates.resolved_at = new Date().toISOString();
  }

  let query = supabaseAdmin
    .from("dead_letter_items")
    .update(updates)
    .eq("id", input.deadLetterItemId);

  if (input.organisationId && input.storeId) {
    query = query
      .eq("organisation_id", input.organisationId)
      .eq("store_id", input.storeId);
  }

  const { error } = await query;

  if (error) {
    throw new Error(
      `Failed to update dead-letter item status: ${error.message}`
    );
  }
}

export async function listRecoveryAttemptsForCancellationRequest(input: {
  cancellationRequestId: string;
}) {
  const { data, error } = await supabaseAdmin
    .from("recovery_attempts")
    .select("*")
    .eq("cancellation_request_id", input.cancellationRequestId)
    .order("attempt_number", { ascending: false });

  if (error) {
    throw new Error(`Failed to load recovery attempts: ${error.message}`);
  }

  return data || [];
}

export async function listDeadLetterItemsForCancellationRequests(input: {
  organisationId: string;
  storeId: string;
  cancellationRequestIds: string[];
}): Promise<DeadLetterItemRecord[]> {
  if (!input.cancellationRequestIds.length) return [];

  const { data, error } = await supabaseAdmin
    .from("dead_letter_items")
    .select("*")
    .eq("organisation_id", input.organisationId)
    .eq("store_id", input.storeId)
    .in("cancellation_request_id", input.cancellationRequestIds)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(`Failed to load dead-letter items: ${error.message}`);
  }

  return ((data || []) as DeadLetterItemRow[]).map(mapDeadLetterItem);
}
