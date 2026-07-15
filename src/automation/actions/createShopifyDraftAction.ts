import { publishEvent } from "@/services/events/eventRepository";
import { getActionTenantContext } from "./context";
import { AutomationActionHandler } from "./types";

export const createShopifyDraftAction: AutomationActionHandler = {
  actionType: "CREATE_SHOPIFY_DRAFT",

  async handle(action) {
    if (!action.productId) {
      throw new Error("CREATE_SHOPIFY_DRAFT requires a product ID.");
    }

    await publishEvent({
      tenantContext: getActionTenantContext(action),
      eventType: "ShopifyPublicationRequested",
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
