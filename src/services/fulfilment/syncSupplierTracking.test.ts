import { beforeEach, describe, expect, it, vi } from "vitest";

import type { TenantContext } from "@/context/storeContext";

vi.mock("server-only", () => ({}));

const { mocks } = vi.hoisted(() => ({
  mocks: {
    registerSupplierConnectors: vi.fn(),
    getSupplierConnector: vi.fn(),
    getSupplierOrderById: vi.fn(),
    updateSupplierOrderTracking: vi.fn(),
    appendSupplierOrderEvent: vi.fn(),
    saveShipmentTracking: vi.fn(),
    saveTrackingEvents: vi.fn(),
    saveDeliveryEvent: vi.fn(),
    publishEvent: vi.fn(),
    getStorePlatform: vi.fn(),
    getPlatformFulfilmentByShipment: vi.fn(),
  },
}));

vi.mock("@/suppliers/registerSupplierConnectors", () => ({
  registerSupplierConnectors: mocks.registerSupplierConnectors,
}));

vi.mock("@/suppliers/SupplierRegistry", () => ({
  getSupplierConnector: mocks.getSupplierConnector,
}));

vi.mock("@/services/repositories/supplierOrderRepository", () => ({
  getSupplierOrderById: mocks.getSupplierOrderById,
  updateSupplierOrderTracking: mocks.updateSupplierOrderTracking,
  appendSupplierOrderEvent: mocks.appendSupplierOrderEvent,
}));

vi.mock("@/services/repositories/trackingRepository", () => ({
  saveShipmentTracking: mocks.saveShipmentTracking,
  saveTrackingEvents: mocks.saveTrackingEvents,
  saveDeliveryEvent: mocks.saveDeliveryEvent,
}));

vi.mock("@/services/events/eventRepository", () => ({
  publishEvent: mocks.publishEvent,
}));
vi.mock("@/services/repositories/storeRepository", () => ({
  getStorePlatform: mocks.getStorePlatform,
}));
vi.mock("@/services/repositories/platformFulfilmentRepository", () => ({
  getPlatformFulfilmentByShipment: mocks.getPlatformFulfilmentByShipment,
}));

import { syncSupplierTracking } from "./syncSupplierTracking";

const tenantContext: TenantContext = {
  organisationId: "org-1",
  storeId: "store-1",
  timezone: "Europe/London",
  currency: "GBP",
  locale: "en-GB",
};

describe("syncSupplierTracking", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getStorePlatform.mockResolvedValue("shopify");
    mocks.getPlatformFulfilmentByShipment.mockResolvedValue(null);
  });

  it("throws when the supplier order is missing", async () => {
    mocks.getSupplierOrderById.mockResolvedValue(null);

    await expect(
      syncSupplierTracking({
        tenantContext,
        supplierOrderId: "supplier-order-1",
      })
    ).rejects.toThrow("Supplier order not found.");
  });

  it("throws when the supplier order has no external order id", async () => {
    mocks.getSupplierOrderById.mockResolvedValue({
      id: "supplier-order-1",
      status: "SHIPPED",
    });

    await expect(
      syncSupplierTracking({
        tenantContext,
        supplierOrderId: "supplier-order-1",
      })
    ).rejects.toThrow("Supplier order has no external order ID.");
  });

  it("returns terminal immediately for cancelled supplier orders", async () => {
    mocks.getSupplierOrderById.mockResolvedValue({
      id: "supplier-order-1",
      status: "CANCELLED",
      externalOrderId: "external-1",
    });

    const result = await syncSupplierTracking({
      tenantContext,
      supplierOrderId: "supplier-order-1",
    });

    expect(result).toEqual({
      supplierOrderId: "supplier-order-1",
      terminal: true,
      status: "CANCELLED",
    });
    expect(mocks.getSupplierConnector).not.toHaveBeenCalled();
  });

  it("persists delivery and stops future syncs for delivered tracking", async () => {
    mocks.getSupplierOrderById.mockResolvedValue({
      id: "supplier-order-1",
      orderId: "order-1",
      provider: "cj",
      status: "SHIPPED",
      externalOrderId: "external-1",
    });
    mocks.getSupplierConnector.mockReturnValue({
      getTracking: vi.fn().mockResolvedValue({
        success: true,
        externalOrderId: "external-1",
        trackingNumber: "TRACK123",
        carrierName: "Royal Mail",
        status: "DELIVERED",
        events: [
          {
            status: "DELIVERED",
            description: "Delivered",
            eventAt: "2026-07-17T10:00:00.000Z",
          },
        ],
        deliveredAt: "2026-07-17T10:00:00.000Z",
        checkedAt: "2026-07-17T10:05:00.000Z",
      }),
    });
    mocks.saveShipmentTracking.mockResolvedValue({ id: "shipment-1" });
    mocks.saveTrackingEvents.mockResolvedValue([]);
    mocks.saveDeliveryEvent.mockResolvedValue({ id: "delivery-1" });

    const result = await syncSupplierTracking({
      tenantContext,
      supplierOrderId: "supplier-order-1",
    });

    expect(mocks.updateSupplierOrderTracking).toHaveBeenCalledWith(
      expect.objectContaining({
        supplierOrderId: "supplier-order-1",
        trackingStatus: "DELIVERED",
        nextTrackingSyncAt: undefined,
      })
    );
    expect(mocks.saveDeliveryEvent).toHaveBeenCalledTimes(1);
    expect(mocks.publishEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: "TrackingReceived",
        metadata: expect.objectContaining({
          idempotencyKey: "shipment-1:TRACK123:shopify",
        }),
      })
    );
    expect(result).toEqual(
      expect.objectContaining({
        supplierOrderId: "supplier-order-1",
        shipmentId: "shipment-1",
        status: "DELIVERED",
        terminal: true,
        nextTrackingSyncAt: undefined,
      })
    );
  });

  it("schedules earlier retry windows for exception tracking states", async () => {
    mocks.getSupplierOrderById.mockResolvedValue({
      id: "supplier-order-1",
      orderId: "order-1",
      provider: "cj",
      status: "SHIPPED",
      externalOrderId: "external-1",
    });
    mocks.getSupplierConnector.mockReturnValue({
      getTracking: vi.fn().mockResolvedValue({
        success: true,
        externalOrderId: "external-1",
        status: "EXCEPTION",
        events: [],
        checkedAt: "2026-07-17T09:00:00.000Z",
      }),
    });
    mocks.saveShipmentTracking.mockResolvedValue({ id: "shipment-1" });
    mocks.saveTrackingEvents.mockResolvedValue([]);

    const result = await syncSupplierTracking({
      tenantContext,
      supplierOrderId: "supplier-order-1",
    });

    const call = mocks.updateSupplierOrderTracking.mock.calls[0]?.[0];
    expect(call.trackingStatus).toBe("EXCEPTION");
    expect(typeof call.nextTrackingSyncAt).toBe("string");
    expect(new Date(call.nextTrackingSyncAt).getTime()).toBeGreaterThan(
      new Date("2026-07-17T09:00:00.000Z").getTime()
    );
    expect(result.terminal).toBe(false);
  });

  it("does not republish tracking when a platform fulfilment already exists", async () => {
    mocks.getSupplierOrderById.mockResolvedValue({
      id: "supplier-order-1",
      orderId: "order-1",
      provider: "cj",
      status: "SHIPPED",
      externalOrderId: "external-1",
    });
    mocks.getSupplierConnector.mockReturnValue({
      getTracking: vi.fn().mockResolvedValue({
        success: true,
        externalOrderId: "external-1",
        trackingNumber: "TRACK123",
        status: "IN_TRANSIT",
        events: [],
        checkedAt: "2026-07-18T09:00:00.000Z",
      }),
    });
    mocks.saveShipmentTracking.mockResolvedValue({ id: "shipment-1" });
    mocks.saveTrackingEvents.mockResolvedValue([]);
    mocks.getPlatformFulfilmentByShipment.mockResolvedValue({
      id: "platform-fulfilment-1",
      externalFulfilmentId: "gid://shopify/Fulfillment/1",
    });

    await syncSupplierTracking({
      tenantContext,
      supplierOrderId: "supplier-order-1",
    });

    expect(mocks.publishEvent).not.toHaveBeenCalled();
  });
});
