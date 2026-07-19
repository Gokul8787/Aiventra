import { beforeEach, describe, expect, it, vi } from "vitest";

import type { TenantContext } from "@/context/storeContext";

vi.mock("server-only", () => ({}));

const { supabaseAdminMock } = vi.hoisted(() => ({
  supabaseAdminMock: {
    from: vi.fn(),
  },
}));

vi.mock("@/services/supabase/admin", () => ({
  supabaseAdmin: supabaseAdminMock,
}));

import {
  buildDeliveryEventDedupeKey,
  buildFulfilmentUpdateDedupeKey,
  buildShipmentTrackingKey,
  buildTrackingEventDedupeKey,
  saveDeliveryEvent,
  saveFulfilmentUpdate,
  saveShipmentTracking,
  saveTrackingEvents,
} from "./trackingRepository";

const context: TenantContext = {
  organisationId: "org-1",
  storeId: "store-1",
  timezone: "Europe/London",
  currency: "GBP",
  locale: "en-GB",
};

function createSingleUpsertChain(result: Record<string, unknown>) {
  const single = vi.fn().mockResolvedValue({ data: result, error: null });
  const select = vi.fn(() => ({ single }));
  const upsert = vi.fn(() => ({ select }));

  return {
    chain: { upsert },
    upsert,
    select,
    single,
  };
}

function createMultiUpsertChain(results: Array<Record<string, unknown>>) {
  const select = vi.fn().mockResolvedValue({ data: results, error: null });
  const upsert = vi.fn(() => ({ select }));

  return {
    chain: { upsert },
    upsert,
    select,
  };
}

describe("trackingRepository keys", () => {
  it("prefers supplier order ids for shipment tracking keys", () => {
    expect(
      buildShipmentTrackingKey({
        orderId: "order-1",
        supplierOrderId: "SUP-123",
        provider: "CJ",
        trackingNumber: "TRACK-1",
      })
    ).toBe("cj:supplier:sup-123");
  });

  it("uses the external tracking event id when present", () => {
    expect(
      buildTrackingEventDedupeKey({
        shipmentTrackingId: "ship-1",
        externalEventId: "EVT-9",
        status: "in_transit",
        occurredAt: "2026-07-17T09:00:00.000Z",
        summary: "Parcel scanned",
      })
    ).toBe("tracking:ship-1:external:evt-9");
  });

  it("creates stable fulfilment and delivery dedupe keys", () => {
    expect(
      buildFulfilmentUpdateDedupeKey({
        orderId: "order-1",
        provider: "shopify",
        externalFulfilmentId: "gid://shopify/Fulfillment/1",
        status: "success",
      })
    ).toBe(
      "fulfilment:shopify:order-1:gid://shopify/fulfillment/1"
    );

    expect(
      buildDeliveryEventDedupeKey({
        shipmentTrackingId: "ship-1",
        eventType: "DELIVERED",
        occurredAt: "2026-07-17T10:00:00.000Z",
        message: "Package delivered",
      })
    ).toBe(
      "delivery:ship-1:delivered:2026-07-17T10:00:00.000Z:package-delivered"
    );
  });
});

describe("trackingRepository persistence", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("saves shipment tracking with a deterministic tracking key", async () => {
    const row = {
      id: "shipment-1",
      organisation_id: "org-1",
      store_id: "store-1",
      order_id: "order-1",
      supplier_order_id: "supplier-1",
      provider: "cj",
      tracking_key: "cj:supplier:supplier-1",
      status: "in_transit",
      tracking_number: "TRACK123",
      courier: "Royal Mail",
      tracking_url: "https://tracking.example/1",
      shipped_at: "2026-07-16T10:00:00.000Z",
      delivered_at: null,
      last_sync_at: "2026-07-17T10:00:00.000Z",
      last_event_at: "2026-07-17T09:00:00.000Z",
      last_event_summary: "Parcel scanned",
      raw_data: { source: "cj" },
      created_at: "2026-07-16T10:00:00.000Z",
      updated_at: "2026-07-17T10:00:00.000Z",
    };
    const mocked = createSingleUpsertChain(row);
    supabaseAdminMock.from.mockReturnValue(mocked.chain);

    const shipment = await saveShipmentTracking({
      context,
      shipment: {
        orderId: "order-1",
        supplierOrderId: "supplier-1",
        provider: "cj",
        status: "in_transit",
        trackingNumber: "TRACK123",
        courier: "Royal Mail",
      },
    });

    expect(supabaseAdminMock.from).toHaveBeenCalledWith("shipment_tracking");
    const [payload, options] = mocked.upsert.mock.calls[0] as unknown as [
      Record<string, unknown>,
      { onConflict: string },
    ];
    expect(payload.tracking_key).toBe("cj:supplier:supplier-1");
    expect(options).toEqual({ onConflict: "store_id,tracking_key" });
    expect(shipment.trackingKey).toBe("cj:supplier:supplier-1");
    expect(shipment.courier).toBe("Royal Mail");
  });

  it("deduplicates tracking events by store and dedupe key", async () => {
    const rows = [
      {
        id: "event-1",
        organisation_id: "org-1",
        store_id: "store-1",
        shipment_tracking_id: "shipment-1",
        provider: "cj",
        dedupe_key: "tracking:shipment-1:external:evt-1",
        external_event_id: "evt-1",
        event_code: "TRANSIT",
        status: "in_transit",
        summary: "In transit",
        details: null,
        location: "London",
        occurred_at: "2026-07-17T09:00:00.000Z",
        raw_data: {},
        created_at: "2026-07-17T09:01:00.000Z",
      },
    ];
    const mocked = createMultiUpsertChain(rows);
    supabaseAdminMock.from.mockReturnValue(mocked.chain);

    const events = await saveTrackingEvents({
      context,
      events: [
        {
          shipmentTrackingId: "shipment-1",
          provider: "cj",
          externalEventId: "evt-1",
          eventCode: "TRANSIT",
          status: "in_transit",
          summary: "In transit",
          location: "London",
          occurredAt: "2026-07-17T09:00:00.000Z",
        },
      ],
    });

    const [payload, options] = mocked.upsert.mock.calls[0] as unknown as [
      Array<Record<string, unknown>>,
      { onConflict: string },
    ];
    expect(payload[0].dedupe_key).toBe("tracking:shipment-1:external:evt-1");
    expect(options).toEqual({ onConflict: "store_id,dedupe_key" });
    expect(events[0].location).toBe("London");
  });

  it("saves fulfilment updates and delivery events with idempotent keys", async () => {
    const fulfilmentMock = createSingleUpsertChain({
      id: "fulfilment-1",
      organisation_id: "org-1",
      store_id: "store-1",
      order_id: "order-1",
      shipment_tracking_id: "shipment-1",
      provider: "shopify",
      dedupe_key: "fulfilment:shopify:order-1:fulfilment-1",
      external_fulfilment_id: "fulfilment-1",
      status: "success",
      request_payload: { trackingNumber: "TRACK123" },
      response_payload: { id: "fulfilment-1" },
      error_message: null,
      processed_at: "2026-07-17T11:00:00.000Z",
      created_at: "2026-07-17T11:00:00.000Z",
    });
    const deliveryMock = createSingleUpsertChain({
      id: "delivery-1",
      organisation_id: "org-1",
      store_id: "store-1",
      order_id: "order-1",
      shipment_tracking_id: "shipment-1",
      dedupe_key:
        "delivery:shipment-1:delivered:2026-07-17T12:00:00.000Z:package-delivered",
      event_type: "DELIVERED",
      status: "delivered",
      message: "Package delivered",
      occurred_at: "2026-07-17T12:00:00.000Z",
      raw_data: {},
      created_at: "2026-07-17T12:00:00.000Z",
    });
    supabaseAdminMock.from
      .mockReturnValueOnce(fulfilmentMock.chain)
      .mockReturnValueOnce(deliveryMock.chain);

    const fulfilment = await saveFulfilmentUpdate({
      context,
      update: {
        orderId: "order-1",
        shipmentTrackingId: "shipment-1",
        provider: "shopify",
        externalFulfilmentId: "fulfilment-1",
        status: "success",
        processedAt: "2026-07-17T11:00:00.000Z",
      },
    });
    const delivery = await saveDeliveryEvent({
      context,
      event: {
        orderId: "order-1",
        shipmentTrackingId: "shipment-1",
        eventType: "DELIVERED",
        status: "delivered",
        message: "Package delivered",
        occurredAt: "2026-07-17T12:00:00.000Z",
      },
    });

    expect(fulfilment.dedupeKey).toBe(
      "fulfilment:shopify:order-1:fulfilment-1"
    );
    expect(delivery.dedupeKey).toBe(
      "delivery:shipment-1:delivered:2026-07-17T12:00:00.000Z:package-delivered"
    );
  });
});
