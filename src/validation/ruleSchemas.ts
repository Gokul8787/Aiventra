import { z } from "zod";

const RuleOperatorSchema = z.enum([
  "eq",
  "neq",
  "gt",
  "gte",
  "lt",
  "lte",
  "in",
  "not_in",
  "exists",
  "not_exists",
]);

const RuleConditionSchema = z.object({
  field: z.string().min(1),
  operator: RuleOperatorSchema,
  value: z.unknown().optional(),
});

const RuleActionSchema = z.object({
  type: z.enum([
    "GENERATE_LISTING",
    "CREATE_SHOPIFY_DRAFT",
    "REQUEST_HUMAN_APPROVAL",
    "WATCH_PRODUCT",
    "IGNORE_PRODUCT",
    "RETIRE_PRODUCT",
    "INCREASE_AD_BUDGET",
    "DECREASE_AD_BUDGET",
    "PAUSE_ADVERTISING",
    "CREATE_INVENTORY_ALERT",
    "RECALCULATE_COST",
    "RECALCULATE_DECISION",
  ]),
  payload: z.record(z.string(), z.unknown()).optional(),
});

export const AutomationRuleInputSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(1000).optional(),

  enabled: z.boolean().default(true),
  priority: z.number().int().min(0).max(10000),
  executionMode: z.enum(["DRY_RUN", "LIVE"]).default("DRY_RUN"),

  logicalOperator: z.enum(["AND", "OR"]),
  conditions: z.array(RuleConditionSchema).min(1),
  actions: z.array(RuleActionSchema).min(1),

  stopProcessing: z.boolean().default(false),
});

export const AutomationRulePatchSchema =
  AutomationRuleInputSchema.partial().extend({
    enabled: z.boolean().optional(),
  });

export type AutomationRuleInput = z.infer<typeof AutomationRuleInputSchema>;
export type AutomationRulePatch = z.infer<typeof AutomationRulePatchSchema>;
