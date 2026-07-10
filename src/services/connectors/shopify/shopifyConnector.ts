import {
  EcommerceConnector,
  PublishProductInput,
  PublishResult,
} from "../types";

import { publishToShopify } from "./products";

export class ShopifyConnector implements EcommerceConnector {
  name = "Shopify";

  async publishProduct(product: PublishProductInput): Promise<PublishResult> {
    return publishToShopify(product);
  }
}
