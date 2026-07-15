import {
  EcommerceConnector,
  PublishProductInput,
  PublishResult,
} from "../types";
import type { TenantContext } from "@/context/storeContext";

import { publishToShopify } from "./products";

export class ShopifyConnector implements EcommerceConnector {
  name = "Shopify";

  async publishProduct(
    tenantContext: TenantContext,
    product: PublishProductInput
  ): Promise<PublishResult> {
    return publishToShopify(tenantContext, product);
  }
}
