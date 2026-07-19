import { describe, expect, it } from "vitest";

import { mapCJTrackingResponse, mapCJTrackingStatus } from "./mapCJTracking";

describe("mapCJTrackingStatus", () => {
  it("maps delivered", () => {
    expect(mapCJTrackingStatus("Delivered")).toBe("DELIVERED");
  });

  it("maps in transit", () => {
    expect(mapCJTrackingStatus("Parcel in transit")).toBe("IN_TRANSIT");
  });

  it("maps out for delivery", () => {
    expect(mapCJTrackingStatus("Out for delivery")).toBe("OUT_FOR_DELIVERY");
  });

  it("maps exceptions", () => {
    expect(mapCJTrackingStatus("Delivery exception")).toBe("EXCEPTION");
  });

  it("maps returns", () => {
    expect(mapCJTrackingStatus("Returned to sender")).toBe("RETURNED");
  });
});

describe("mapCJTrackingResponse", () => {
  it("maps tracking details and events", () => {
    const result = mapCJTrackingResponse({
      externalOrderId: "cj-order-1",
      response: {
        code: 200,
        result: true,
        data: {
          trackingNumber: "TRACK123",
          carrierName: "Royal Mail",
          trackingStatus: "In Transit",
          events: [
            {
              id: "event-1",
              status: "Information received",
              description: "Label created",
              eventTime: "2026-07-01T10:00:00Z",
            },
            {
              id: "event-2",
              status: "In Transit",
              description: "Parcel departed",
              eventTime: "2026-07-02T10:00:00Z",
            },
          ],
        },
      },
    });

    expect(result.success).toBe(true);
    expect(result.trackingNumber).toBe("TRACK123");
    expect(result.status).toBe("IN_TRANSIT");
    expect(result.events).toHaveLength(2);
  });
});
