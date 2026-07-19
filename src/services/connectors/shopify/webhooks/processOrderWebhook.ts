import "server-only";

import { ORDER_EVENTS } from "@/orders/events";
import { enqueueOrderValidationJob } from "@/services/jobs/enqueueOrderValidationJob";
import { publishEvent } from "@/services/events/eventRepository";
import { redactSensitiveData } from "@/security/redactSensitiveData";
import { upsertCustomer } from "@/services/repositories/customerRepository";
import {
  getOrderByShopifyId,
  saveOrderFromWebhook,
  updateOrderStatusByShopifyId,
} from "@/services/repositories/orderRepository";
import { createCancellationRequest } from "@/services/repositories/cancellationRepository";
import { persistRefund } from "@/services/repositories/refundRepository";
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

function getShopifyOrderId(payload: Record<string, unknown>) {
  return String(
    payload.order_id || payload.orderId || payload.id || payload.admin_graphql_api_id || ""
  )
    .split("/")
    .pop() || "";
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

  const shopifyOrderId = getShopifyOrderId(payload);

  if (!shopifyOrderId) {
    throw new Error("Refund webhook is missing order_id.");
  }

  const internalOrder = await getOrderByShopifyId(tenantContext, shopifyOrderId);

  if (!internalOrder) {
    await markWebhookProcessed({
      webhookEventId: webhook.id,
      processed: true,
    });

    return {
      success: true,
      message: "Refund webhook recorded, but matching order was not found.",
    };
  }

  const refundLineItems = Array.isArray(payload.refund_line_items)
    ? payload.refund_line_items
    : [];

  const refundItems = refundLineItems
    .map((entry) => {
      if (!entry || typeof entry !== "object") {
        return null;
      }

      const record = entry as Record<string, unknown>;
      const lineItem =
        record.line_item && typeof record.line_item === "object"
          ? (record.line_item as Record<string, unknown>)
          : undefined;
      const externalLineItemId = record.line_item_id ?? lineItem?.id;

      if (!externalLineItemId) {
        return null;
      }

      const subtotalAmount = Number(record.subtotal ?? 0);
      const taxAmount = Number(record.total_tax ?? 0);

      return {
        externalLineItemId: String(externalLineItemId),
        quantity: Math.max(1, Number(record.quantity ?? 1)),
        subtotalAmount,
        taxAmount,
        totalAmount: subtotalAmount + taxAmount,
        restockType:
          typeof record.restock_type === "string" ? record.restock_type : undefined,
        reason: typeof record.reason === "string" ? record.reason : undefined,
      };
    })
    .filter(
      (item): item is NonNullable<typeof item> => item !== null
    );

  const refundSubtotal = refundItems.reduce(
    (total, item) => total + item.subtotalAmount,
    0
  );

  const refundTax = refundItems.reduce(
    (total, item) => total + item.taxAmount,
    0
  );

  const refundShipping = Array.isArray(payload.refund_shipping_lines)
    ? payload.refund_shipping_lines.reduce((total: number, shippingLine) => {
        if (!shippingLine || typeof shippingLine !== "object") {
          return total;
        }

        const line = shippingLine as Record<string, unknown>;
        return total + Number(line.subtotal ?? line.amount ?? 0);
      }, 0)
    : 0;

  const refundResult = await persistRefund({
    organisationId: tenantContext.organisationId,
    storeId: tenantContext.storeId,
    orderId: internalOrder.id,
    platform: "shopify",
    externalRefundId: String(payload.id),
    currency: String(payload.currency ?? internalOrder.currency ?? "GBP"),
    subtotalAmount: refundSubtotal,
    taxAmount: refundTax,
    shippingAmount: refundShipping,
    totalAmount: refundSubtotal + refundTax + refundShipping,
    note: typeof payload.note === "string" ? payload.note : undefined,
    processedAt:
      typeof payload.processed_at === "string" ? payload.processed_at : undefined,
    items: refundItems,
    payload: redactSensitiveData(payload),
  });

  if (!refundResult.duplicate) {
    await publishEvent({
      tenantContext,
      eventType: ORDER_EVENTS.refundRecorded,
      aggregateType: "order",
      aggregateId: internalOrder.id,
      payload: {
        orderId: internalOrder.id,
        refundId: refundResult.refundId,
        externalRefundId: String(payload.id),
        shopifyOrderId,
        shopifyWebhookId: headers.webhookId,
      },
      metadata: {
        shopDomain: headers.shopDomain,
        shopifyEventId: headers.eventId,
        source: "shopify-webhook",
        idempotencyKey: [
          "refund-recorded",
          tenantContext.storeId,
          String(payload.id),
        ].join(":"),
      },
    });
  }

  await markWebhookProcessed({
    webhookEventId: webhook.id,
    processed: true,
  });

  return {
    success: true,
    orderId: internalOrder.id,
    message: refundResult.duplicate
      ? "Duplicate refund ignored."
      : "Refund recorded.",
  };
}

export async function processShopifyCancellationWebhook(input: {
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

  const shopifyOrderId = getShopifyOrderId(payload);

  if (!shopifyOrderId) {
    throw new Error("Cancellation webhook is missing order id.");
  }

  const internalOrder = await updateOrderStatusByShopifyId({
    tenantContext,
    shopifyOrderId,
    status: "cancelled",
    cancelledAt:
      typeof payload.cancelled_at === "string"
        ? payload.cancelled_at
        : new Date().toISOString(),
    rawData: payload,
  });

  if (!internalOrder) {
    await markWebhookProcessed({
      webhookEventId: webhook.id,
      processed: true,
    });

    return {
      success: true,
      message: "Cancellation webhook recorded, but matching order was not found.",
    };
  }

  const cancellationRequest = await createCancellationRequest({
    organisationId: tenantContext.organisationId,
    storeId: tenantContext.storeId,
    orderId: internalOrder.id,
    source: "shopify",
    reason:
      typeof payload.cancel_reason === "string"
        ? payload.cancel_reason
        : "Shopify order cancelled.",
    metadata: {
      externalOrderId: String(payload.id),
      cancelledAt: payload.cancelled_at ?? null,
    },
  });

  await publishEvent({
    tenantContext,
    eventType: ORDER_EVENTS.cancellationRequested,
    aggregateType: "order",
    aggregateId: internalOrder.id,
    payload: {
      organisationId: tenantContext.organisationId,
      storeId: tenantContext.storeId,
      orderId: internalOrder.id,
      cancellationRequestId: cancellationRequest.id,
    },
    metadata: {
      source: "shopify-webhook",
      shopDomain: headers.shopDomain,
      shopifyEventId: headers.eventId,
      idempotencyKey: [
        "order-cancellation-requested",
        tenantContext.storeId,
        internalOrder.id,
      ].join(":"),
    },
  });

  await markWebhookProcessed({
    webhookEventId: webhook.id,
    processed: true,
  });

  return {
    success: true,
    orderId: internalOrder.id,
    message: "Cancellation request recorded.",
  };
}
