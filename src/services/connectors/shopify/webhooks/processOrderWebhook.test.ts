import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { mocks } = vi.hoisted(() => ({
  mocks: {
    verifyShopifyWebhook: vi.fn(),
    getShopifyWebhookHeaders: vi.fn(),
    resolveShopifyTenantContext: vi.fn(),
    recordWebhookEvent: vi.fn(),
    markWebhookProcessed: vi.fn(),
    getOrderByShopifyId: vi.fn(),
    updateOrderStatusByShopifyId: vi.fn(),
    persistRefund: vi.fn(),
    createCancellationRequest: vi.fn(),
    publishEvent: vi.fn(),
    getSupplierConnector: vi.fn(),
  },
}));

vi.mock("./verifyWebhook", () => ({
  verifyShopifyWebhook: mocks.verifyShopifyWebhook,
  getShopifyWebhookHeaders: mocks.getShopifyWebhookHeaders,
}));

vi.mock("@/services/repositories/webhookRepository", () => ({
  resolveShopifyTenantContext: mocks.resolveShopifyTenantContext,
  recordWebhookEvent: mocks.recordWebhookEvent,
  markWebhookProcessed: mocks.markWebhookProcessed,
}));

vi.mock("@/services/repositories/orderRepository", () => ({
  getOrderByShopifyId: mocks.getOrderByShopifyId,
  updateOrderStatusByShopifyId: mocks.updateOrderStatusByShopifyId,
  saveOrderFromWebhook: vi.fn(),
}));

vi.mock("@/services/repositories/refundRepository", () => ({
  persistRefund: mocks.persistRefund,
}));

vi.mock("@/services/repositories/cancellationRepository", () => ({
  createCancellationRequest: mocks.createCancellationRequest,
}));

vi.mock("@/services/events/eventRepository", () => ({
  publishEvent: mocks.publishEvent,
}));

vi.mock("@/services/jobs/enqueueOrderValidationJob", () => ({
  enqueueOrderValidationJob: vi.fn(),
}));

vi.mock("@/services/repositories/customerRepository", () => ({
  upsertCustomer: vi.fn(),
}));

vi.mock("@/suppliers/SupplierRegistry", () => ({
  getSupplierConnector: mocks.getSupplierConnector,
}));

import {
  processShopifyCancellationWebhook,
  processShopifyRefundWebhook,
} from "./processOrderWebhook";

const tenantContext = {
  organisationId: "org-1",
  storeId: "store-1",
  timezone: "Europe/London",
  currency: "GBP",
  locale: "en-GB",
};

function buildRequest(body: Record<string, unknown>) {
  return new Request("http://localhost/webhook", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

describe("processOrderWebhook recovery flows", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.verifyShopifyWebhook.mockReturnValue(true);
    mocks.getShopifyWebhookHeaders.mockReturnValue({
      hmac: "ok",
      webhookId: "webhook-1",
      eventId: "event-1",
      shopDomain: "example.myshopify.com",
    });
    mocks.resolveShopifyTenantContext.mockResolvedValue(tenantContext);
    mocks.recordWebhookEvent.mockResolvedValue({
      id: "webhook-row-1",
      duplicate: false,
      processed: false,
    });
  });

  it("records a refund event for a partial refund", async () => {
    mocks.getOrderByShopifyId.mockResolvedValue({
      id: "order-1",
      currency: "GBP",
    });
    mocks.persistRefund.mockResolvedValue({
      refundId: "refund-1",
      duplicate: false,
    });

    const result = await processShopifyRefundWebhook({
      request: buildRequest({
        id: "refund-ext-1",
        order_id: "shopify-order-1",
        currency: "GBP",
        refund_line_items: [
          {
            line_item_id: "line-1",
            quantity: 1,
            subtotal: 40,
            total_tax: 8,
          },
        ],
      }),
      topic: "refunds/create",
    });

    expect(mocks.persistRefund).toHaveBeenCalled();
    expect(mocks.publishEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: "RefundRecorded",
      })
    );
    expect(result.success).toBe(true);
  });

  it("does not publish a second refund event for a duplicate refund", async () => {
    mocks.getOrderByShopifyId.mockResolvedValue({
      id: "order-1",
      currency: "GBP",
    });
    mocks.persistRefund.mockResolvedValue({
      refundId: "refund-1",
      duplicate: true,
    });

    await processShopifyRefundWebhook({
      request: buildRequest({
        id: "refund-ext-1",
        order_id: "shopify-order-1",
        currency: "GBP",
      }),
      topic: "refunds/create",
    });

    expect(mocks.publishEvent).not.toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: "RefundRecorded",
      })
    );
  });

  it("creates one cancellation request for a non-duplicate cancellation webhook", async () => {
    mocks.updateOrderStatusByShopifyId.mockResolvedValue({
      id: "order-1",
    });
    mocks.createCancellationRequest.mockResolvedValue({
      id: "cancel-1",
    });

    await processShopifyCancellationWebhook({
      request: buildRequest({
        id: "shopify-order-1",
        cancelled_at: "2026-07-18T10:00:00.000Z",
        cancel_reason: "customer",
      }),
      topic: "orders/cancelled",
    });

    expect(mocks.createCancellationRequest).toHaveBeenCalledTimes(1);
    expect(mocks.publishEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: "OrderCancellationRequested",
      })
    );
    expect(mocks.getSupplierConnector).not.toHaveBeenCalled();
  });

  it("does not create a second cancellation request for a duplicate webhook", async () => {
    mocks.recordWebhookEvent.mockResolvedValue({
      id: "webhook-row-1",
      duplicate: true,
      processed: true,
    });

    const result = await processShopifyCancellationWebhook({
      request: buildRequest({
        id: "shopify-order-1",
      }),
      topic: "orders/cancelled",
    });

    expect(mocks.createCancellationRequest).not.toHaveBeenCalled();
    expect(result.duplicate).toBe(true);
  });
});
