import { PublishProductInput, PublishResult } from "../types";

import { shopifyFetch } from "./client";

export async function publishToShopify(
  product: PublishProductInput
): Promise<PublishResult> {
  const result = await shopifyFetch("products.json", {
    method: "POST",
    body: JSON.stringify({
      product: {
        title: product.title,
        body_html: product.description,
        handle: product.handle,
        tags: product.tags.join(","),
        variants: [
          {
            price: String(product.price),
            compare_at_price: product.compareAtPrice
              ? String(product.compareAtPrice)
              : undefined,
          },
        ],
      },
    }),
  });

  return {
    success: true,
    externalId: result.product?.id?.toString(),
    externalUrl: result.product?.admin_graphql_api_id,
  };
}
