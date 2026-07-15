import { publishEvent } from "@/services/events/eventRepository";
import { getActionTenantContext } from "./context";
import { AutomationActionHandler } from "./types";

export const watchProductAction: AutomationActionHandler = {
  actionType: "WATCH_PRODUCT",

  async handle(action) {
    if (!action.productId) {
      throw new Error("WATCH_PRODUCT requires a product ID.");
    }

    await publishEvent({
      tenantContext: getActionTenantContext(action),
      eventType: "ProductWatchScheduled",
      aggregateType: "product",
      aggregateId: action.productId,
      payload: {
        organisationId: action.organisationId,
        storeId: action.storeId,
        productId: action.productId,
        automationActionId: action.id,
        recheckAfterHours: action.payload.recheckAfterHours ?? 24,
      },
      metadata: {
        idempotencyKey: action.idempotencyKey,
      },
    });
  },
};
