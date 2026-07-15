import "server-only";

import type { TenantContext } from "@/context/storeContext";
import { supabaseAdmin } from "@/services/supabase/admin";
import {
  AutomationRule,
  RuleAction,
  RuleCondition,
  RuleEvaluationResult,
} from "@/ai/rules/types";
import type {
  AutomationRuleInput,
  AutomationRulePatch,
} from "@/validation/ruleSchemas";

type RuleRow = {
  id: string;
  organisation_id: string;
  store_id: string | null;
  name: string;
  description: string | null;
  enabled: boolean;
  priority: number;
  execution_mode: "DRY_RUN" | "LIVE";
  logical_operator: "AND" | "OR";
  conditions: RuleCondition[];
  actions: RuleAction[];
  stop_processing: boolean;
  version: number;
  created_at: string;
  updated_at: string;
};

type RuleEvaluationRow = {
  id: string;
  rule_id: string;
  product_id: string | null;
  scan_id: string | null;
  matched: boolean;
  execution_mode: "DRY_RUN" | "LIVE";
  condition_results: RuleEvaluationResult["conditionResults"];
  actions: RuleAction[];
  engine_version: string;
  evaluated_at: string;
  automation_rules?:
    | {
        name: string;
      }
    | Array<{
        name: string;
      }>
    | null;
};

export type AutomationRuleWithStats = AutomationRule & {
  matchCount: number;
  failureCount: number;
  lastMatchedAt?: string;
};

export type RuleEvaluationRecord = {
  id: string;
  ruleId: string;
  ruleName: string;
  productId?: string;
  scanId?: string;
  matched: boolean;
  executionMode: "DRY_RUN" | "LIVE";
  conditionResults: RuleEvaluationResult["conditionResults"];
  actions: RuleAction[];
  engineVersion: string;
  evaluatedAt: string;
};

function mapRule(row: RuleRow): AutomationRule {
  return {
    id: row.id,
    organisationId: row.organisation_id,
    storeId: row.store_id || undefined,
    name: row.name,
    description: row.description || undefined,
    enabled: row.enabled,
    priority: row.priority,
    executionMode: row.execution_mode,
    logicalOperator: row.logical_operator,
    conditions: row.conditions || [],
    actions: row.actions || [],
    stopProcessing: row.stop_processing,
    version: row.version,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toRuleRow(input: AutomationRuleInput | AutomationRulePatch) {
  return {
    name: input.name,
    description: input.description ?? null,
    enabled: input.enabled,
    priority: input.priority,
    execution_mode: input.executionMode,
    logical_operator: input.logicalOperator,
    conditions: input.conditions,
    actions: input.actions,
    stop_processing: input.stopProcessing,
  };
}

function toRulePatchRow(input: AutomationRulePatch) {
  return {
    ...(input.name !== undefined ? { name: input.name } : {}),
    ...(input.description !== undefined
      ? { description: input.description ?? null }
      : {}),
    ...(input.enabled !== undefined ? { enabled: input.enabled } : {}),
    ...(input.priority !== undefined ? { priority: input.priority } : {}),
    ...(input.executionMode !== undefined
      ? { execution_mode: input.executionMode }
      : {}),
    ...(input.logicalOperator !== undefined
      ? { logical_operator: input.logicalOperator }
      : {}),
    ...(input.conditions !== undefined ? { conditions: input.conditions } : {}),
    ...(input.actions !== undefined ? { actions: input.actions } : {}),
    ...(input.stopProcessing !== undefined
      ? { stop_processing: input.stopProcessing }
      : {}),
  };
}

function mapEvaluation(row: RuleEvaluationRow): RuleEvaluationRecord {
  const rule =
    Array.isArray(row.automation_rules)
      ? row.automation_rules[0]
      : row.automation_rules;

  return {
    id: row.id,
    ruleId: row.rule_id,
    ruleName: rule?.name || "Automation rule",
    productId: row.product_id || undefined,
    scanId: row.scan_id || undefined,
    matched: row.matched,
    executionMode: row.execution_mode,
    conditionResults: row.condition_results || [],
    actions: row.actions || [],
    engineVersion: row.engine_version,
    evaluatedAt: row.evaluated_at,
  };
}

export async function getActiveRules(
  tenantContext: TenantContext
): Promise<AutomationRule[]> {
  const { data, error } = await supabaseAdmin
    .from("automation_rules")
    .select("*")
    .eq("organisation_id", tenantContext.organisationId)
    .eq("enabled", true)
    .or(`store_id.eq.${tenantContext.storeId},store_id.is.null`)
    .order("priority", { ascending: false });

  if (error) {
    throw new Error(`Failed to load automation rules: ${error.message}`);
  }

  return ((data || []) as RuleRow[]).map(mapRule);
}

export async function listAutomationRules(
  tenantContext: TenantContext
): Promise<AutomationRuleWithStats[]> {
  const { data, error } = await supabaseAdmin
    .from("automation_rules")
    .select("*")
    .eq("organisation_id", tenantContext.organisationId)
    .or(`store_id.eq.${tenantContext.storeId},store_id.is.null`)
    .order("priority", { ascending: false });

  if (error) {
    throw new Error(`Failed to load automation rules: ${error.message}`);
  }

  const rules = ((data || []) as RuleRow[]).map(mapRule);

  if (rules.length === 0) return [];

  const { data: evaluations, error: evaluationsError } = await supabaseAdmin
    .from("rule_evaluations")
    .select("rule_id, matched, evaluated_at")
    .eq("organisation_id", tenantContext.organisationId)
    .eq("store_id", tenantContext.storeId)
    .in(
      "rule_id",
      rules.map((rule) => rule.id)
    );

  if (evaluationsError) {
    throw new Error(
      `Failed to load automation rule stats: ${evaluationsError.message}`
    );
  }

  const stats = new Map<
    string,
    { matchCount: number; failureCount: number; lastMatchedAt?: string }
  >();

  for (const row of evaluations || []) {
    const current = stats.get(row.rule_id) || {
      matchCount: 0,
      failureCount: 0,
      lastMatchedAt: undefined,
    };

    if (row.matched) {
      current.matchCount += 1;
      if (!current.lastMatchedAt || row.evaluated_at > current.lastMatchedAt) {
        current.lastMatchedAt = row.evaluated_at;
      }
    } else {
      current.failureCount += 1;
    }

    stats.set(row.rule_id, current);
  }

  return rules.map((rule) => ({
    ...rule,
    matchCount: stats.get(rule.id)?.matchCount || 0,
    failureCount: stats.get(rule.id)?.failureCount || 0,
    lastMatchedAt: stats.get(rule.id)?.lastMatchedAt,
  }));
}

export async function getAutomationRule(
  tenantContext: TenantContext,
  ruleId: string
): Promise<AutomationRule | null> {
  const { data, error } = await supabaseAdmin
    .from("automation_rules")
    .select("*")
    .eq("organisation_id", tenantContext.organisationId)
    .or(`store_id.eq.${tenantContext.storeId},store_id.is.null`)
    .eq("id", ruleId)
    .maybeSingle<RuleRow>();

  if (error) {
    throw new Error(`Failed to load automation rule: ${error.message}`);
  }

  return data ? mapRule(data) : null;
}

export async function createAutomationRule(
  tenantContext: TenantContext,
  input: AutomationRuleInput
): Promise<AutomationRule> {
  const { data, error } = await supabaseAdmin
    .from("automation_rules")
    .insert({
      organisation_id: tenantContext.organisationId,
      store_id: tenantContext.storeId,
      ...toRuleRow(input),
    })
    .select("*")
    .single<RuleRow>();

  if (error || !data) {
    throw new Error(
      `Failed to create automation rule: ${error?.message || "No row returned"}`
    );
  }

  return mapRule(data);
}

export async function updateAutomationRule(
  tenantContext: TenantContext,
  ruleId: string,
  input: AutomationRulePatch
): Promise<AutomationRule | null> {
  const row = toRulePatchRow(input);

  const { data, error } = await supabaseAdmin
    .from("automation_rules")
    .update({
      ...row,
      updated_at: new Date().toISOString(),
    })
    .eq("organisation_id", tenantContext.organisationId)
    .eq("store_id", tenantContext.storeId)
    .eq("id", ruleId)
    .select("*")
    .maybeSingle<RuleRow>();

  if (error) {
    throw new Error(`Failed to update automation rule: ${error.message}`);
  }

  return data ? mapRule(data) : null;
}

export async function disableAutomationRule(
  tenantContext: TenantContext,
  ruleId: string
): Promise<void> {
  const { error } = await supabaseAdmin
    .from("automation_rules")
    .update({
      enabled: false,
      updated_at: new Date().toISOString(),
    })
    .eq("organisation_id", tenantContext.organisationId)
    .eq("store_id", tenantContext.storeId)
    .eq("id", ruleId);

  if (error) {
    throw new Error(`Failed to disable automation rule: ${error.message}`);
  }
}

export async function saveRuleEvaluation(input: {
  organisationId: string;
  storeId: string;
  productDatabaseId?: string;
  scanId?: string;
  result: RuleEvaluationResult;
}): Promise<string> {
  const { data, error } = await supabaseAdmin
    .from("rule_evaluations")
    .insert({
      organisation_id: input.organisationId,
      store_id: input.storeId,
      rule_id: input.result.ruleId,
      product_id: input.productDatabaseId || null,
      scan_id: input.scanId || null,
      matched: input.result.matched,
      execution_mode: input.result.executionMode,
      condition_results: input.result.conditionResults,
      actions: input.result.actions,
      engine_version: input.result.engineVersion,
      evaluated_at: input.result.evaluatedAt,
    })
    .select("id")
    .single<{ id: string }>();

  if (error || !data) {
    throw new Error(
      `Failed to save rule evaluation: ${error?.message || "No row returned"}`
    );
  }

  return data.id;
}

export async function createAutomationAction(input: {
  organisationId: string;
  storeId: string;
  ruleEvaluationId: string;
  productDatabaseId?: string;
  action: RuleAction;
  idempotencyKey: string;
  status?: string;
}): Promise<string> {
  const { data, error } = await supabaseAdmin
    .from("automation_actions")
    .upsert(
      {
        organisation_id: input.organisationId,
        store_id: input.storeId,
        rule_evaluation_id: input.ruleEvaluationId,
        product_id: input.productDatabaseId || null,
        action_type: input.action.type,
        payload: input.action.payload || {},
        status: input.status || "pending",
        idempotency_key: input.idempotencyKey,
      },
      {
        onConflict: "idempotency_key",
        ignoreDuplicates: true,
      }
    )
    .select("id")
    .maybeSingle<{ id: string }>();

  if (error) {
    throw new Error(`Failed to create automation action: ${error.message}`);
  }

  return data?.id || "";
}

export async function getRuleEvaluationsForProduct(input: {
  tenantContext: TenantContext;
  productId: string;
  limit?: number;
}): Promise<RuleEvaluationRecord[]> {
  const { data, error } = await supabaseAdmin
    .from("rule_evaluations")
    .select(
      `
        id,
        rule_id,
        product_id,
        scan_id,
        matched,
        execution_mode,
        condition_results,
        actions,
        engine_version,
        evaluated_at,
        automation_rules (
          name
        )
      `
    )
    .eq("organisation_id", input.tenantContext.organisationId)
    .eq("store_id", input.tenantContext.storeId)
    .eq("product_id", input.productId)
    .order("evaluated_at", { ascending: false })
    .limit(input.limit ?? 20);

  if (error) {
    throw new Error(`Failed to load rule evaluations: ${error.message}`);
  }

  return ((data || []) as RuleEvaluationRow[]).map(mapEvaluation);
}
