import { PublishProductInput, PublishResult } from "../types";

export async function publishToShopify(
  _product: PublishProductInput
): Promise<PublishResult> {
  return {
    success: false,
    message:
      "Shopify GraphQL publishing is not enabled yet. Test the connection first.",
  };
}
