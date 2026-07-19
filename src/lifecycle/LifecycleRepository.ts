import "server-only";

import type {
  ProductLifecycleStage,
  ProductLifecycleStatus,
} from "./ProductLifecycle";
import type { LifecycleTransition } from "./ProductLifecycleTransition";
import { supabaseAdmin } from "@/services/supabase/admin";
import type { TenantContext } from "@/context/storeContext";
import { tenantColumns } from "@/context/storeContext";

const NEXT_STAGE: Partial<Record<ProductLifecycleStage, ProductLifecycleStage>> = {
  DISCOVERED: "ANALYSED",
  ANALYSED: "AI_APPROVED",
  AI_APPROVED: "LISTING_GENERATED",
  LISTING_GENERATED: "DRAFT_CREATED",
  DRAFT_CREATED: "PUBLISHED",
  PUBLISHED: "ADVERTISING",
  ADVERTISING: "SELLING",
  SELLING: "SCALING",
};

type LifecycleHistoryRow = {
  from_stage: ProductLifecycleStage | null;
  current_stage: ProductLifecycleStage;
  lifecycle_status: ProductLifecycleStatus | null;
  changed_at: string;
  changed_by: string;
  reason: string;
};

export function canTransition(
  from: ProductLifecycleStage | undefined,
  to: ProductLifecycleStage
) {
  if (!from) return to === "DISCOVERED";
  if (from === to) return true;
  if (to === "RETIRED") return true;

  return NEXT_STAGE[from] === to;
}

export async function getCurrentLifecycle(
  tenantContext: TenantContext,
  productId: string
): Promise<{
  stage: ProductLifecycleStage;
  status: ProductLifecycleStatus;
  changedAt: string;
} | null> {
  const { data, error } = await supabaseAdmin
    .from("products")
    .select("current_lifecycle, lifecycle_status, lifecycle_changed_at")
    .eq("organisation_id", tenantContext.organisationId)
    .eq("store_id", tenantContext.storeId)
    .eq("id", productId)
    .maybeSingle<{
      current_lifecycle: ProductLifecycleStage | null;
      lifecycle_status: ProductLifecycleStatus | null;
      lifecycle_changed_at: string | null;
    }>();

  if (error) {
    throw new Error(`Failed to load current lifecycle: ${error.message}`);
  }

  if (!data?.current_lifecycle) return null;

  return {
    stage: data.current_lifecycle,
    status: data.lifecycle_status || "ACTIVE",
    changedAt: data.lifecycle_changed_at || new Date().toISOString(),
  };
}

export async function moveToLifecycle(input: {
  tenantContext: TenantContext;
  productId: string;
  to: ProductLifecycleStage;
  reason: string;
  actor: string;
  status?: ProductLifecycleStatus;
}): Promise<LifecycleTransition> {
  const current = await getCurrentLifecycle(
    input.tenantContext,
    input.productId
  );
  const from = current?.stage;

  if (!canTransition(from, input.to)) {
    throw new Error(
      `Invalid lifecycle transition from ${from || "NONE"} to ${input.to}`
    );
  }

  const timestamp = new Date().toISOString();
  const status = input.status || "ACTIVE";

  const { error: productError } = await supabaseAdmin
    .from("products")
    .update({
      current_lifecycle: input.to,
      lifecycle_status: status,
      lifecycle_changed_at: timestamp,
    })
    .eq("organisation_id", input.tenantContext.organisationId)
    .eq("store_id", input.tenantContext.storeId)
    .eq("id", input.productId);

  if (productError) {
    throw new Error(`Failed to update product lifecycle: ${productError.message}`);
  }

  const { error: historyError } = await supabaseAdmin
    .from("product_lifecycle")
    .insert({
      ...tenantColumns(input.tenantContext),
      product_id: input.productId,
      from_stage: from || null,
      current_stage: input.to,
      lifecycle_status: status,
      changed_at: timestamp,
      changed_by: input.actor,
      reason: input.reason,
    });

  if (historyError) {
    throw new Error(`Failed to save lifecycle history: ${historyError.message}`);
  }

  return {
    from,
    to: input.to,
    reason: input.reason,
    timestamp,
    actor: input.actor,
    status,
  };
}

export async function getHistory(
  tenantContext: TenantContext,
  productId: string
): Promise<LifecycleTransition[]> {
  const { data, error } = await supabaseAdmin
    .from("product_lifecycle")
    .select(
      "from_stage, current_stage, lifecycle_status, changed_at, changed_by, reason"
    )
    .eq("organisation_id", tenantContext.organisationId)
    .eq("store_id", tenantContext.storeId)
    .eq("product_id", productId)
    .order("changed_at", { ascending: true });

  if (error) {
    throw new Error(`Failed to load lifecycle history: ${error.message}`);
  }

  return ((data || []) as LifecycleHistoryRow[]).map((row) => ({
    from: row.from_stage || undefined,
    to: row.current_stage,
    reason: row.reason,
    timestamp: row.changed_at,
    actor: row.changed_by,
    status: row.lifecycle_status || "ACTIVE",
  }));
}
