import { publishEvent } from "@/services/events/eventRepository";
import { getActionTenantContext } from "./context";
import { AutomationActionHandler } from "./types";

export const generateListingAction: AutomationActionHandler = {
  actionType: "GENERATE_LISTING",

  async handle(action) {
    if (!action.productId) {
      throw new Error("GENERATE_LISTING requires a product ID.");
    }

    await publishEvent({
      tenantContext: getActionTenantContext(action),
      eventType: "ListingGenerationRequested",
      aggregateType: "product",
      aggregateId: action.productId,
      payload: {
        organisationId: action.organisationId,
        storeId: action.storeId,
        productId: action.productId,
        automationActionId: action.id,
      },
      metadata: {
        idempotencyKey: action.idempotencyKey,
      },
    });
  },
};
