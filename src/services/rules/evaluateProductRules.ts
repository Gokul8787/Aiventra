import "server-only";

import { Product } from "@/ai/types/product";
import { RuleAction } from "@/ai/rules/types";
import { evaluateRules } from "@/ai/rules/rulesEngine";
import { resolveActionConflicts } from "@/ai/rules/actionConflictResolver";
import { AUTOMATION_SAFETY_LIMITS } from "@/automation/safetyLimits";
import {
  createAutomationAction,
  getActiveRules,
  saveRuleEvaluation,
} from "@/services/repositories/rulesRepository";
import { publishEvent } from "@/services/events/eventRepository";

type EvaluationActionCandidate = {
  evaluationId: string;
  ruleId: string;
  evaluatedAt: string;
  action: RuleAction;
};

function requiresApproval(product: Product, action: RuleAction) {
  if (action.type === "INCREASE_AD_BUDGET") return true;

  if (!["CREATE_SHOPIFY_DRAFT", "GENERATE_LISTING"].includes(action.type)) {
    return false;
  }

  if (
    action.type === "CREATE_SHOPIFY_DRAFT" &&
    product.decision?.automationAllowed !== true
  ) {
    return true;
  }

  if (
    (product.decision?.confidence || 0) <
    AUTOMATION_SAFETY_LIMITS.minimumDecisionConfidence
  ) {
    return true;
  }

  if (
    (product.costAnalysis?.netMarginPercent || 0) <
    AUTOMATION_SAFETY_LIMITS.minimumNetMarginPercent
  ) {
    return true;
  }

  if (
    (product.supplierReliability?.supplierScore || 0) <
    AUTOMATION_SAFETY_LIMITS.minimumSupplierScore
  ) {
    return true;
  }

  if (product.supplierReliability?.dataQuality !== "verified") {
    return true;
  }

  return false;
}

export async function evaluateProductRules(input: {
  organisationId: string;
  storeId: string;
  product: Product;
  productDatabaseId?: string;
  scanId?: string;

  sales?: {
    ordersToday?: number;
    ordersLast7Days?: number;
    revenueToday?: number;
    revenueLast7Days?: number;
  };

  advertising?: {
    dailyBudget?: number;
    spendToday?: number;
    roas?: number;
    cpa?: number;
  };

  inventory?: {
    currentStock?: number;
    daysOfStockRemaining?: number;
  };

  lifecycle?: {
    stage?: string;
    status?: string;
  };
}) {
  const tenantContext = {
    organisationId: input.organisationId,
    storeId: input.storeId,
    timezone: "Europe/London",
    currency: input.product.currency || "GBP",
    locale: "en-GB",
  };
  const rules = await getActiveRules({
    ...tenantContext,
  });

  const results = evaluateRules(rules, {
    organisationId: input.organisationId,
    storeId: input.storeId,
    product: input.product,
    sales: input.sales,
    advertising: input.advertising,
    inventory: input.inventory,
    lifecycle: input.lifecycle,
  });

  const candidates: EvaluationActionCandidate[] = [];

  for (const result of results) {
    const evaluationId = await saveRuleEvaluation({
      organisationId: input.organisationId,
      storeId: input.storeId,
      productDatabaseId: input.productDatabaseId,
      scanId: input.scanId,
      result,
    });

    await publishEvent({
      tenantContext,
      eventType: "RulesEvaluated",
      aggregateType: "product",
      aggregateId: input.productDatabaseId || input.product.id,
      payload: {
        ruleId: result.ruleId,
        ruleName: result.ruleName,
        ruleEvaluationId: evaluationId,
        matched: result.matched,
        executionMode: result.executionMode,
        actionCount: result.actions.length,
        scanId: input.scanId,
      },
    });

    if (!result.matched || result.executionMode !== "LIVE") continue;

    for (const action of result.actions) {
      candidates.push({
        evaluationId,
        ruleId: result.ruleId,
        evaluatedAt: result.evaluatedAt,
        action,
      });
    }
  }

  const resolvedActions = resolveActionConflicts(
    candidates.map((candidate) => candidate.action)
  );
  const pendingCandidates = [...candidates];

  for (const action of resolvedActions) {
    const candidateIndex = pendingCandidates.findIndex(
      (candidate) => candidate.action.type === action.type
    );

    if (candidateIndex === -1) continue;

    const [candidate] = pendingCandidates.splice(candidateIndex, 1);
    const idempotencyKey = [
      input.organisationId,
      input.storeId,
      input.productDatabaseId || input.product.id,
      candidate.ruleId,
      action.type,
      candidate.evaluatedAt.slice(0, 10),
    ].join(":");

    const actionId = await createAutomationAction({
      organisationId: input.organisationId,
      storeId: input.storeId,
      ruleEvaluationId: candidate.evaluationId,
      productDatabaseId: input.productDatabaseId,
      action,
      idempotencyKey,
      status: requiresApproval(input.product, action)
        ? "approval_required"
        : "pending",
    });

    if (actionId) {
      await publishEvent({
        tenantContext,
        eventType: "AutomationActionCreated",
        aggregateType: "automation_action",
        aggregateId: actionId,
        payload: {
          actionId,
          actionType: action.type,
          productId: input.productDatabaseId,
          ruleEvaluationId: candidate.evaluationId,
          idempotencyKey,
        },
      });
    }
  }

  return results;
}
