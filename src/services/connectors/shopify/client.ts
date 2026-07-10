const SHOPIFY_STORE = process.env.SHOPIFY_STORE_DOMAIN || "";

const SHOPIFY_TOKEN = process.env.SHOPIFY_ACCESS_TOKEN || "";

export async function shopifyFetch(endpoint: string, options: RequestInit = {}) {
  const response = await fetch(
    `https://${SHOPIFY_STORE}/admin/api/2024-10/${endpoint}`,
    {
      ...options,
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Access-Token": SHOPIFY_TOKEN,
        ...(options.headers || {}),
      },
    }
  );

  if (!response.ok) {
    throw new Error(`Shopify API Error ${response.status}`);
  }

  return response.json();
}
