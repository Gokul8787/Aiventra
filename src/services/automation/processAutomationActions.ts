import "server-only";

import { RuleActionType } from "@/ai/rules/types";
import { getAutomationActionHandler } from "@/automation/actionRegistry";
import { AUTOMATION_SAFETY_LIMITS } from "@/automation/safetyLimits";
import { registerActionHandlers } from "@/automation/registerActionHandlers";
import { supabaseAdmin } from "@/services/supabase/admin";

type ActionRow = {
  id: string;
  organisation_id: string;
  store_id: string;
  product_id: string | null;
  action_type: RuleActionType;
  payload: Record<string, unknown>;
  idempotency_key: string;
  attempts: number;
};

function startOfToday() {
  const date = new Date();

  date.setHours(0, 0, 0, 0);

  return date.toISOString();
}

function numberPayload(
  payload: Record<string, unknown>,
  key: string
): number | undefined {
  const value = Number(payload[key]);

  return Number.isFinite(value) ? value : undefined;
}

async function countToday(input: {
  organisationId: string;
  storeId: string;
  actionType: RuleActionType;
}) {
  const { count, error } = await supabaseAdmin
    .from("automation_actions")
    .select("id", { count: "exact", head: true })
    .eq("organisation_id", input.organisationId)
    .eq("store_id", input.storeId)
    .eq("action_type", input.actionType)
    .in("status", ["running", "completed", "queued"])
    .gte("created_at", startOfToday());

  if (error) {
    throw new Error(`Failed to check automation limits: ${error.message}`);
  }

  return count || 0;
}

async function enforceSafety(row: ActionRow): Promise<"continue" | "approval"> {
  if (row.action_type === "CREATE_SHOPIFY_DRAFT") {
    const draftsToday = await countToday({
      organisationId: row.organisation_id,
      storeId: row.store_id,
      actionType: "CREATE_SHOPIFY_DRAFT",
    });

    if (draftsToday >= AUTOMATION_SAFETY_LIMITS.maximumDailyShopifyDrafts) {
      throw new Error("Daily Shopify draft automation limit reached.");
    }
  }

  if (row.action_type === "INCREASE_AD_BUDGET") {
    const amount = numberPayload(row.payload, "amount");
    const percent = numberPayload(row.payload, "percent");

    if (
      amount != null &&
      amount > AUTOMATION_SAFETY_LIMITS.maximumDailyAdBudgetIncrease
    ) {
      throw new Error("Ad budget increase exceeds the daily safety limit.");
    }

    if (
      percent != null &&
      percent > AUTOMATION_SAFETY_LIMITS.maximumSingleBudgetIncreasePercent
    ) {
      throw new Error("Ad budget increase exceeds the single-change limit.");
    }

    if (AUTOMATION_SAFETY_LIMITS.requireApprovalForAdSpend) {
      return "approval";
    }
  }

  return "continue";
}

export async function processAutomationActions(limit = 10) {
  registerActionHandlers();

  const { data, error } = await supabaseAdmin
    .from("automation_actions")
    .select("*")
    .eq("status", "pending")
    .order("created_at", {
      ascending: true,
    })
    .limit(limit);

  if (error) {
    throw new Error(`Failed to load automation actions: ${error.message}`);
  }

  const results = [];

  for (const row of (data || []) as ActionRow[]) {
    const { data: claimed } = await supabaseAdmin
      .from("automation_actions")
      .update({
        status: "running",
        attempts: row.attempts + 1,
        started_at: new Date().toISOString(),
      })
      .eq("id", row.id)
      .eq("status", "pending")
      .select("*")
      .maybeSingle<ActionRow>();

    if (!claimed) continue;

    try {
      const safetyDecision = await enforceSafety(row);

      if (safetyDecision === "approval") {
        await supabaseAdmin
          .from("automation_actions")
          .update({
            status: "approval_required",
            completed_at: new Date().toISOString(),
          })
          .eq("id", row.id);

        results.push({
          actionId: row.id,
          status: "approval_required",
        });

        continue;
      }

      const handler = getAutomationActionHandler(row.action_type);

      if (!handler) {
        throw new Error(`No handler registered for ${row.action_type}.`);
      }

      await handler.handle({
        id: row.id,
        organisationId: row.organisation_id,
        storeId: row.store_id,
        productId: row.product_id || undefined,
        actionType: row.action_type,
        payload: row.payload || {},
        idempotencyKey: row.idempotency_key,
      });

      await supabaseAdmin
        .from("automation_actions")
        .update({
          status: "completed",
          completed_at: new Date().toISOString(),
        })
        .eq("id", row.id);

      results.push({
        actionId: row.id,
        status: "completed",
      });
    } catch (actionError) {
      const message =
        actionError instanceof Error
          ? actionError.message
          : "Unknown action error.";

      await supabaseAdmin
        .from("automation_actions")
        .update({
          status: "failed",
          last_error: message,
          completed_at: new Date().toISOString(),
        })
        .eq("id", row.id);

      results.push({
        actionId: row.id,
        status: "failed",
        message,
      });
    }
  }

  return results;
}
