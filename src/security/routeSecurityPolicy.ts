export const PUBLIC_ROUTES = [
  "/api/webhooks/shopify/orders-paid",
  "/api/webhooks/shopify/orders-cancelled",
  "/api/webhooks/shopify/refunds-create",
] as const;

export const INTERNAL_ROUTES = [
  "/api/internal/jobs/process",
  "/api/internal/jobs/schedule",
  "/api/internal/jobs/recover",
  "/api/internal/events/process",
  "/api/internal/automation/actions/process",
] as const;
