import { getShopifyAccessToken } from "./auth";

const SHOPIFY_API_VERSION = "2026-07";

type ShopifyGraphQLError = {
  message: string;
  path?: Array<string | number>;
};

type ShopifyGraphQLResponse<T> = {
  data?: T;
  errors?: ShopifyGraphQLError[];
};

function getShopDomain(): string {
  const shop = process.env.SHOPIFY_STORE_DOMAIN?.trim();

  if (!shop) {
    throw new Error("Missing required environment variable: SHOPIFY_STORE_DOMAIN");
  }

  return shop.replace(/^https?:\/\//, "").replace(/\/+$/, "");
}

export async function shopifyGraphQL<T>(
  query: string,
  variables: Record<string, unknown> = {}
): Promise<T> {
  const shop = getShopDomain();
  const accessToken = await getShopifyAccessToken();

  const response = await fetch(
    `https://${shop}/admin/api/${SHOPIFY_API_VERSION}/graphql.json`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Access-Token": accessToken,
      },
      body: JSON.stringify({
        query,
        variables,
      }),
      cache: "no-store",
    }
  );

  const responseText = await response.text();

  if (!response.ok) {
    throw new Error(
      `Shopify API request failed (${response.status}): ${responseText}`
    );
  }

  let result: ShopifyGraphQLResponse<T>;

  try {
    result = JSON.parse(responseText) as ShopifyGraphQLResponse<T>;
  } catch {
    throw new Error("Shopify returned an invalid GraphQL response.");
  }

  if (result.errors?.length) {
    throw new Error(result.errors.map((error) => error.message).join("; "));
  }

  if (!result.data) {
    throw new Error("Shopify GraphQL response did not contain data.");
  }

  return result.data;
}
