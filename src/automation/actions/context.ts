import type { TenantContext } from "@/context/storeContext";
import type { AutomationActionRecord } from "./types";

export function getActionTenantContext(
  action: AutomationActionRecord
): TenantContext {
  return {
    organisationId: action.organisationId,
    storeId: action.storeId,
    timezone: "Europe/London",
    currency: "GBP",
    locale: "en-GB",
  };
}
