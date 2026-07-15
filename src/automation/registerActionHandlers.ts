import { registerAutomationActionHandler } from "./actionRegistry";
import { createShopifyDraftAction } from "./actions/createShopifyDraftAction";
import { generateListingAction } from "./actions/generateListingAction";
import { watchProductAction } from "./actions/watchProductAction";

let registered = false;

export function registerActionHandlers(): void {
  if (registered) return;

  registerAutomationActionHandler(generateListingAction);
  registerAutomationActionHandler(createShopifyDraftAction);
  registerAutomationActionHandler(watchProductAction);

  registered = true;
}
