export function getShopifyApiVersion() {
  return process.env.SHOPIFY_API_VERSION?.trim() || "2026-07";
}
