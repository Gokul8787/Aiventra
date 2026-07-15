import "server-only";

import { ORDER_EVENTS } from "@/orders/events";
import { enqueueOrderValidationJob } from "@/services/jobs/enqueueOrderValidationJob";
import { publishEvent } from "@/services/events/eventRepository";
import { upsertCustomer } from "@/services/repositories/customerRepository";
import {
  saveOrderFromWebhook,
  updateOrderStatusByShopifyId,
} from "@/services/repositories/orderRepository";
import {
  markWebhookProcessed,
  recordWebhookEvent,
  resolveShopifyTenantContext,
} from "@/services/repositories/webhookRepository";
import type { CommerceOrderStatus } from "@/orders/status";
import { parseShopifyCustomer, parseShopifyOrder } from "./parseOrder";
import {
  getShopifyWebhookHeaders,
  verifyShopifyWebhook,
} from "./verifyWebhook";

type WebhookProcessResult = {
  success: boolean;
  duplicate?: boolean;
  orderId?: string;
  validationJobId?: string;
  message?: string;
};

function parseJson(rawBody: string): Record<string, unknown> {
  try {
    return JSON.parse(rawBody) as Record<string, unknown>;
  } catch {
    throw new Error("Shopify webhook payload is not valid JSON.");
  }
}

export async function processShopifyOrderWebhook(input: {
  request: Request;
  topic: string;
  status: CommerceOrderStatus;
  enqueueValidation?: boolean;
}): Promise<WebhookProcessResult> {
  const rawBody = await input.request.text();
  const headers = getShopifyWebhookHeaders(input.request);

  if (!verifyShopifyWebhook({ rawBody, hmacHeader: headers.hmac })) {
    throw new Error("Shopify webhook HMAC verification failed.");
  }

  if (!headers.webhookId) {
    throw new Error("Shopify webhook is missing X-Shopify-Webhook-Id.");
  }

  if (!headers.shopDomain) {
    throw new Error("Shopify webhook is missing X-Shopify-Shop-Domain.");
  }

  const payload = parseJson(rawBody);
  const tenantContext = await resolveShopifyTenantContext(headers.shopDomain);
  const webhook = await recordWebhookEvent({
    tenantContext,
    provider: "shopify",
    event: input.topic,
    externalId: headers.webhookId,
    eventId: headers.eventId,
    shopDomain: headers.shopDomain,
    payload,
  });

  if (webhook.duplicate && webhook.processed) {
    return {
      success: true,
      duplicate: true,
      message: "Duplicate webhook delivery ignored.",
    };
  }

  const customerInput = parseShopifyCustomer(payload);
  const customer = await upsertCustomer({
    tenantContext,
    ...customerInput,
  });
  const orderInput = parseShopifyOrder(payload, input.status);
  const { order, items } = await saveOrderFromWebhook({
    tenantContext,
    order: orderInput,
    customerId: customer?.id,
  });

  const eventId = await publishEvent({
    tenantContext,
    eventType:
      input.status === "refunded"
        ? ORDER_EVENTS.refunded
        : input.status === "cancelled"
          ? ORDER_EVENTS.cancelled
          : ORDER_EVENTS.received,
    aggregateType: "order",
    aggregateId: order.id,
    payload: {
      orderId: order.id,
      shopifyOrderId: order.shopifyOrderId,
      shopifyWebhookId: headers.webhookId,
      itemCount: items.length,
      total: order.total,
      currency: order.currency,
    },
    metadata: {
      shopDomain: headers.shopDomain,
      shopifyEventId: headers.eventId,
    },
  });

  const validationJob = input.enqueueValidation
    ? await enqueueOrderValidationJob({
        tenantContext,
        orderId: order.id,
        correlationId: eventId,
        causationId: eventId,
      })
    : null;

  await markWebhookProcessed({
    webhookEventId: webhook.id,
    processed: true,
  });

  return {
    success: true,
    orderId: order.id,
    validationJobId: validationJob?.jobId,
  };
}

export async function processShopifyRefundWebhook(input: {
  request: Request;
  topic: string;
}): Promise<WebhookProcessResult> {
  const rawBody = await input.request.text();
  const headers = getShopifyWebhookHeaders(input.request);

  if (!verifyShopifyWebhook({ rawBody, hmacHeader: headers.hmac })) {
    throw new Error("Shopify webhook HMAC verification failed.");
  }

  if (!headers.webhookId) {
    throw new Error("Shopify webhook is missing X-Shopify-Webhook-Id.");
  }

  if (!headers.shopDomain) {
    throw new Error("Shopify webhook is missing X-Shopify-Shop-Domain.");
  }

  const payload = parseJson(rawBody);
  const tenantContext = await resolveShopifyTenantContext(headers.shopDomain);
  const webhook = await recordWebhookEvent({
    tenantContext,
    provider: "shopify",
    event: input.topic,
    externalId: headers.webhookId,
    eventId: headers.eventId,
    shopDomain: headers.shopDomain,
    payload,
  });

  if (webhook.duplicate && webhook.processed) {
    return {
      success: true,
      duplicate: true,
      message: "Duplicate webhook delivery ignored.",
    };
  }

  const shopifyOrderId =
    String(payload.order_id || payload.orderId || payload.admin_graphql_api_id || "")
      .split("/")
      .pop() || "";

  if (!shopifyOrderId) {
    throw new Error("Refund webhook is missing order_id.");
  }

  const order = await updateOrderStatusByShopifyId({
    tenantContext,
    shopifyOrderId,
    status: "refunded",
    refundedAt: new Date().toISOString(),
    rawData: payload,
  });

  if (order) {
    await publishEvent({
      tenantContext,
      eventType: ORDER_EVENTS.refunded,
      aggregateType: "order",
      aggregateId: order.id,
      payload: {
        orderId: order.id,
        shopifyOrderId,
        shopifyWebhookId: headers.webhookId,
      },
      metadata: {
        shopDomain: headers.shopDomain,
        shopifyEventId: headers.eventId,
      },
    });
  }

  await markWebhookProcessed({
    webhookEventId: webhook.id,
    processed: true,
  });

  return {
    success: true,
    orderId: order?.id,
    message: order
      ? "Order marked as refunded."
      : "Refund webhook recorded, but matching order was not found.",
  };
}
