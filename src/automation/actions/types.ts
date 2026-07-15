import { RuleActionType } from "@/ai/rules/types";

export interface AutomationActionRecord {
  id: string;
  organisationId: string;
  storeId: string;
  productId?: string;
  actionType: RuleActionType;
  payload: Record<string, unknown>;
  idempotencyKey: string;
}

export interface AutomationActionHandler {
  actionType: RuleActionType;

  handle(action: AutomationActionRecord): Promise<void>;
}
