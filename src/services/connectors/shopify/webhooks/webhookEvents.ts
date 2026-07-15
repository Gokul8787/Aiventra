export const SHOPIFY_WEBHOOK_EVENTS = {
  ordersPaid: "orders/paid",
  ordersCancelled: "orders/cancelled",
  refundsCreate: "refunds/create",
} as const;

export type ShopifyWebhookTopic =
  (typeof SHOPIFY_WEBHOOK_EVENTS)[keyof typeof SHOPIFY_WEBHOOK_EVENTS];
