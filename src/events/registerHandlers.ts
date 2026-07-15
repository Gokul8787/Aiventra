import { registerEventHandler } from "./handlerRegistry";
import { productScanRequestedHandler } from "./handlers/productScanRequestedHandler";
import { shopifyOrderReceivedHandler } from "./handlers/shopifyOrderReceivedHandler";

let registered = false;

export function registerHandlers(): void {
  if (registered) return;

  registerEventHandler(productScanRequestedHandler);
  registerEventHandler(shopifyOrderReceivedHandler);

  registered = true;
}
