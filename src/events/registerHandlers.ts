import { orderCancellationRequestedHandler } from "./handlers/orderCancellationRequestedHandler";
import { registerEventHandler } from "./handlerRegistry";
import { productScanRequestedHandler } from "./handlers/productScanRequestedHandler";
import { shopifyOrderReceivedHandler } from "./handlers/shopifyOrderReceivedHandler";
import { trackingReceivedHandler } from "./handlers/trackingReceivedHandler";

let registered = false;

export function registerHandlers(): void {
  if (registered) return;

  registerEventHandler(orderCancellationRequestedHandler);
  registerEventHandler(productScanRequestedHandler);
  registerEventHandler(shopifyOrderReceivedHandler);
  registerEventHandler(trackingReceivedHandler);

  registered = true;
}
