import { registerFulfilmentProvider } from "./FulfilmentRegistry";
import { ShopifyFulfilmentProvider } from "./shopify/ShopifyFulfilmentProvider";

let registered = false;

export function registerFulfilmentProviders() {
  if (registered) return;

  registerFulfilmentProvider(new ShopifyFulfilmentProvider());

  registered = true;
}
