import { RuleActionType } from "@/ai/rules/types";
import { AutomationActionHandler } from "./actions/types";

const handlers = new Map<RuleActionType, AutomationActionHandler>();

export function registerAutomationActionHandler(
  handler: AutomationActionHandler
): void {
  handlers.set(handler.actionType, handler);
}

export function getAutomationActionHandler(
  actionType: RuleActionType
): AutomationActionHandler | undefined {
  return handlers.get(actionType);
}
