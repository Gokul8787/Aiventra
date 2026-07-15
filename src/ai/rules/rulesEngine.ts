import {
  AutomationRule,
  RuleEvaluationContext,
  RuleEvaluationResult,
} from "./types";
import { resolveActionConflicts } from "./actionConflictResolver";
import { evaluateCondition } from "./conditionEvaluator";

export const RULES_ENGINE_VERSION = "1.0.0";

function isRetired(context: RuleEvaluationContext) {
  return (
    context.lifecycle?.stage === "RETIRED" ||
    context.product.currentLifecycle === "RETIRED"
  );
}

function shouldBlockPublishingAction(
  context: RuleEvaluationContext,
  actionType: string
) {
  if (!["GENERATE_LISTING", "CREATE_SHOPIFY_DRAFT"].includes(actionType)) {
    return false;
  }

  if (isRetired(context)) return true;

  const margin = context.product.costAnalysis?.netMarginPercent;

  return typeof margin === "number" && margin < 0;
}

export function evaluateRule(
  rule: AutomationRule,
  context: RuleEvaluationContext
): RuleEvaluationResult {
  const conditionResults = rule.conditions.map((condition) =>
    evaluateCondition(context, condition)
  );

  const matched =
    rule.logicalOperator === "AND"
      ? conditionResults.every((result) => result.matched)
      : conditionResults.some((result) => result.matched);

  const safeActions = matched
    ? resolveActionConflicts(rule.actions).filter(
        (action) => !shouldBlockPublishingAction(context, action.type)
      )
    : [];

  return {
    ruleId: rule.id,
    ruleName: rule.name,
    matched,
    executionMode: rule.executionMode,
    conditionResults,
    actions: safeActions,
    evaluatedAt: new Date().toISOString(),
    engineVersion: RULES_ENGINE_VERSION,
  };
}

export function evaluateRules(
  rules: AutomationRule[],
  context: RuleEvaluationContext
): RuleEvaluationResult[] {
  const activeRules = rules
    .filter((rule) => rule.enabled)
    .sort((a, b) => b.priority - a.priority);

  const results: RuleEvaluationResult[] = [];

  for (const rule of activeRules) {
    const result = evaluateRule(rule, context);

    results.push(result);

    if (result.matched && rule.stopProcessing) {
      break;
    }
  }

  return results;
}
