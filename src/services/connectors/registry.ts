import { ShopifyConnector } from "./shopify/shopifyConnector";

export const connectorRegistry = {
  shopify: new ShopifyConnector(),
};
