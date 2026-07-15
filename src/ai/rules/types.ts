import { Product } from "@/ai/types/product";

export type RuleOperator =
  | "eq"
  | "neq"
  | "gt"
  | "gte"
  | "lt"
  | "lte"
  | "in"
  | "not_in"
  | "exists"
  | "not_exists";

export type RuleLogicalOperator = "AND" | "OR";

export type RuleExecutionMode = "DRY_RUN" | "LIVE";

export type RuleActionType =
  | "GENERATE_LISTING"
  | "CREATE_SHOPIFY_DRAFT"
  | "REQUEST_HUMAN_APPROVAL"
  | "WATCH_PRODUCT"
  | "IGNORE_PRODUCT"
  | "RETIRE_PRODUCT"
  | "INCREASE_AD_BUDGET"
  | "DECREASE_AD_BUDGET"
  | "PAUSE_ADVERTISING"
  | "CREATE_INVENTORY_ALERT"
  | "RECALCULATE_COST"
  | "RECALCULATE_DECISION";

export interface RuleCondition {
  field: string;
  operator: RuleOperator;
  value?: unknown;
}

export interface RuleAction {
  type: RuleActionType;
  payload?: Record<string, unknown>;
}

export interface AutomationRule {
  id: string;
  organisationId: string;
  storeId?: string;

  name: string;
  description?: string;

  enabled: boolean;
  priority: number;
  executionMode: RuleExecutionMode;

  logicalOperator: RuleLogicalOperator;
  conditions: RuleCondition[];
  actions: RuleAction[];

  stopProcessing: boolean;

  version: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface RuleEvaluationContext {
  organisationId: string;
  storeId: string;

  product: Product;

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
}

export interface RuleConditionResult {
  condition: RuleCondition;
  actualValue: unknown;
  matched: boolean;
  reason: string;
}

export interface RuleEvaluationResult {
  ruleId: string;
  ruleName: string;
  matched: boolean;
  executionMode: RuleExecutionMode;

  conditionResults: RuleConditionResult[];
  actions: RuleAction[];

  evaluatedAt: string;
  engineVersion: string;
}
