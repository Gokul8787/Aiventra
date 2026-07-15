import { RuleAction, RuleActionType } from "./types";

const ACTION_PRECEDENCE: RuleActionType[] = [
  "RETIRE_PRODUCT",
  "PAUSE_ADVERTISING",
  "REQUEST_HUMAN_APPROVAL",
  "DECREASE_AD_BUDGET",
  "INCREASE_AD_BUDGET",
  "CREATE_SHOPIFY_DRAFT",
  "GENERATE_LISTING",
  "WATCH_PRODUCT",
  "IGNORE_PRODUCT",
  "CREATE_INVENTORY_ALERT",
  "RECALCULATE_COST",
  "RECALCULATE_DECISION",
];

const ADVERTISING_CONFLICTS = new Set<RuleActionType>([
  "PAUSE_ADVERTISING",
  "INCREASE_AD_BUDGET",
  "DECREASE_AD_BUDGET",
]);

const PRODUCT_OUTCOME_CONFLICTS = new Set<RuleActionType>([
  "RETIRE_PRODUCT",
  "IGNORE_PRODUCT",
  "WATCH_PRODUCT",
  "GENERATE_LISTING",
  "CREATE_SHOPIFY_DRAFT",
]);

function getPrecedence(action: RuleAction) {
  const index = ACTION_PRECEDENCE.indexOf(action.type);

  return index === -1 ? ACTION_PRECEDENCE.length : index;
}

function pickHighestPrecedence(actions: RuleAction[]) {
  return [...actions].sort((a, b) => getPrecedence(a) - getPrecedence(b))[0];
}

export function resolveActionConflicts(actions: RuleAction[]): RuleAction[] {
  const uniqueByType = new Map<RuleActionType, RuleAction>();

  for (const action of actions) {
    if (!uniqueByType.has(action.type)) {
      uniqueByType.set(action.type, action);
    }
  }

  const uniqueActions = Array.from(uniqueByType.values());
  const resolved: RuleAction[] = [];
  const advertisingActions = uniqueActions.filter((action) =>
    ADVERTISING_CONFLICTS.has(action.type)
  );
  const productOutcomeActions = uniqueActions.filter((action) =>
    PRODUCT_OUTCOME_CONFLICTS.has(action.type)
  );

  if (advertisingActions.length > 0) {
    resolved.push(pickHighestPrecedence(advertisingActions));
  }

  if (productOutcomeActions.length > 0) {
    resolved.push(pickHighestPrecedence(productOutcomeActions));
  }

  for (const action of uniqueActions) {
    if (
      ADVERTISING_CONFLICTS.has(action.type) ||
      PRODUCT_OUTCOME_CONFLICTS.has(action.type)
    ) {
      continue;
    }

    resolved.push(action);
  }

  return resolved.sort((a, b) => getPrecedence(a) - getPrecedence(b));
}
