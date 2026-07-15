import "server-only";

import crypto from "crypto";

function getWebhookSecret() {
  const secret =
    process.env.SHOPIFY_WEBHOOK_SECRET ||
    process.env.SHOPIFY_API_SECRET ||
    process.env.SHOPIFY_CLIENT_SECRET;

  if (!secret) {
    throw new Error(
      "Missing Shopify webhook secret. Set SHOPIFY_WEBHOOK_SECRET."
    );
  }

  return secret;
}

export function verifyShopifyWebhook(input: {
  rawBody: string;
  hmacHeader: string | null;
}): boolean {
  if (!input.hmacHeader) return false;

  const calculated = crypto
    .createHmac("sha256", getWebhookSecret())
    .update(input.rawBody, "utf8")
    .digest("base64");

  const receivedBuffer = Buffer.from(input.hmacHeader, "base64");
  const calculatedBuffer = Buffer.from(calculated, "base64");

  if (receivedBuffer.length !== calculatedBuffer.length) return false;

  return crypto.timingSafeEqual(receivedBuffer, calculatedBuffer);
}

export function getShopifyWebhookHeaders(request: Request) {
  return {
    hmac: request.headers.get("x-shopify-hmac-sha256"),
    webhookId: request.headers.get("x-shopify-webhook-id"),
    eventId: request.headers.get("x-shopify-event-id") || undefined,
    topic: request.headers.get("x-shopify-topic") || undefined,
    shopDomain: request.headers.get("x-shopify-shop-domain") || undefined,
  };
}
