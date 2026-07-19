import { beforeEach, describe, expect, it, vi } from "vitest";

import type { TenantContext } from "@/context/storeContext";

vi.mock("server-only", () => ({}));

const { mocks } = vi.hoisted(() => ({
  mocks: {
    registerFulfilmentProviders: vi.fn(),
    getFulfilmentProvider: vi.fn(),
    assertOrderWorkAllowed: vi.fn(),
    getOrderById: vi.fn(),
    getOrderItems: vi.fn(),
    markOrderItemsFulfilled: vi.fn(),
    getShipmentTrackingById: vi.fn(),
    getStorePlatform: vi.fn(),
    getSupplierOrderById: vi.fn(),
    listSupplierOrderItems: vi.fn(),
    getPlatformFulfilmentByShipment: vi.fn(),
    upsertPlatformFulfilment: vi.fn(),
    appendPlatformFulfilmentEvent: vi.fn(),
    publishEvent: vi.fn(),
  },
}));

vi.mock("@/fulfilment/providers/registerFulfilmentProviders", () => ({
  registerFulfilmentProviders: mocks.registerFulfilmentProviders,
}));
vi.mock("@/fulfilment/providers/FulfilmentRegistry", () => ({
  getFulfilmentProvider: mocks.getFulfilmentProvider,
}));
vi.mock("@/services/recovery/assertOrderWorkAllowed", () => ({
  assertOrderWorkAllowed: mocks.assertOrderWorkAllowed,
}));
vi.mock("@/services/repositories/orderRepository", () => ({
  getOrderById: mocks.getOrderById,
  getOrderItems: mocks.getOrderItems,
  markOrderItemsFulfilled: mocks.markOrderItemsFulfilled,
}));
vi.mock("@/services/repositories/trackingRepository", () => ({
  getShipmentTrackingById: mocks.getShipmentTrackingById,
}));
vi.mock("@/services/repositories/storeRepository", () => ({
  getStorePlatform: mocks.getStorePlatform,
}));
vi.mock("@/services/repositories/supplierOrderRepository", () => ({
  getSupplierOrderById: mocks.getSupplierOrderById,
  listSupplierOrderItems: mocks.listSupplierOrderItems,
}));
vi.mock("@/services/repositories/platformFulfilmentRepository", () => ({
  getPlatformFulfilmentByShipment: mocks.getPlatformFulfilmentByShipment,
  upsertPlatformFulfilment: mocks.upsertPlatformFulfilment,
  appendPlatformFulfilmentEvent: mocks.appendPlatformFulfilmentEvent,
}));
vi.mock("@/services/events/eventRepository", () => ({
  publishEvent: mocks.publishEvent,
}));

import { createPlatformFulfilment } from "./createPlatformFulfilment";

const tenantContext: TenantContext = {
  organisationId: "org-1",
  storeId: "store-1",
  timezone: "Europe/London",
  currency: "GBP",
  locale: "en-GB",
};

function baseOrder() {
  return {
    id: "order-1",
    shopifyOrderId: "gid://shopify/Order/1",
    shopifyAdminGraphqlApiId: "gid://shopify/Order/1",
    status: "awaiting_fulfilment",
    financialStatus: "paid",
  };
}

function baseShipment() {
  return {
    id: "shipment-1",
    orderId: "order-1",
    trackingNumber: "TRACK123",
    trackingUrl: "https://tracking.example/1",
    courier: "Royal Mail",
  };
}

describe("createPlatformFulfilment", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.assertOrderWorkAllowed.mockResolvedValue(undefined);
    mocks.getStorePlatform.mockResolvedValue("shopify");
    mocks.getOrderItems.mockResolvedValue([
      {
        id: "order-item-1",
        shopifyLineItemId: "li-1",
        fulfilmentStatus: "supplier_ordered",
      },
    ]);
    mocks.getSupplierOrderById.mockResolvedValue(null);
    mocks.listSupplierOrderItems.mockResolvedValue([
      {
        orderItemId: "order-item-1",
        quantity: 1,
        supplierProductId: "supplier-product-1",
      },
    ]);
  });

  it("blocks when tracking is missing", async () => {
    mocks.getOrderById.mockResolvedValue(baseOrder());
    mocks.getShipmentTrackingById.mockResolvedValue({
      ...baseShipment(),
      trackingNumber: undefined,
    });

    await expect(
      createPlatformFulfilment({
        tenantContext,
        orderId: "order-1",
        shipmentTrackingId: "shipment-1",
      })
    ).rejects.toThrow("Shipment tracking number is missing.");
  });

  it("deduplicates when the platform already has the fulfilment", async () => {
    mocks.getOrderById.mockResolvedValue(baseOrder());
    mocks.getShipmentTrackingById.mockResolvedValue(baseShipment());
    mocks.getPlatformFulfilmentByShipment.mockResolvedValue(null);
    mocks.getFulfilmentProvider.mockReturnValue({
      getFulfilmentOrders: vi.fn().mockResolvedValue([
        {
          id: "fo-1",
          supportedActions: ["CREATE_FULFILLMENT"],
          lineItems: [
            {
              id: "fo-line-1",
              lineItemId: "li-1",
              remainingQuantity: 1,
            },
          ],
          existingFulfilments: [
            {
              id: "ful-1",
              status: "SUCCESS",
              trackingNumbers: ["TRACK123"],
              trackingUrls: ["https://tracking.example/1"],
            },
          ],
        },
      ]),
    });
    mocks.upsertPlatformFulfilment.mockResolvedValue({ id: "pf-1" });

    const result = await createPlatformFulfilment({
      tenantContext,
      orderId: "order-1",
      shipmentTrackingId: "shipment-1",
      supplierOrderId: "supplier-order-1",
    });

    expect(result.status).toBe("already_exists");
    expect(mocks.markOrderItemsFulfilled).toHaveBeenCalledWith(
      expect.objectContaining({
        orderItemIds: ["order-item-1"],
      })
    );
  });

  it("creates a fulfilment when none exists yet", async () => {
    mocks.getOrderById.mockResolvedValue(baseOrder());
    mocks.getShipmentTrackingById.mockResolvedValue(baseShipment());
    mocks.getPlatformFulfilmentByShipment.mockResolvedValue(null);
    const provider = {
      getFulfilmentOrders: vi.fn().mockResolvedValue([
        {
          id: "fo-1",
          supportedActions: ["CREATE_FULFILLMENT"],
          lineItems: [
            {
              id: "fo-line-1",
              lineItemId: "li-1",
              remainingQuantity: 1,
            },
          ],
          existingFulfilments: [],
        },
      ]),
      createFulfilment: vi.fn().mockResolvedValue({
        success: true,
        externalFulfilmentId: "gid://shopify/Fulfillment/1",
        externalOrderId: "gid://shopify/Order/1",
        externalFulfilmentOrderIds: ["fo-1"],
        trackingNumber: "TRACK123",
        trackingUrl: "https://tracking.example/1",
        carrier: "Royal Mail",
        status: "SUCCESS",
        customerNotified: true,
        raw: {},
      }),
    };
    mocks.getFulfilmentProvider.mockReturnValue(provider);
    mocks.upsertPlatformFulfilment.mockResolvedValue({ id: "pf-1" });

    const result = await createPlatformFulfilment({
      tenantContext,
      orderId: "order-1",
      shipmentTrackingId: "shipment-1",
      supplierOrderId: "supplier-order-1",
    });

    expect(provider.createFulfilment).toHaveBeenCalledWith(
      expect.objectContaining({
        lineItems: [
          expect.objectContaining({
            orderItemId: "order-item-1",
            fulfilmentOrderId: "fo-1",
            fulfilmentOrderLineItemId: "fo-line-1",
            quantity: 1,
          }),
        ],
      })
    );
    expect(result.status).toBe("created");
    expect(mocks.publishEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: "Fulfilled",
      })
    );
  });
});
