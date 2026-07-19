import { describe, expect, it } from "vitest";

import { redactSensitiveData } from "./redactSensitiveData";

describe("redactSensitiveData", () => {
  it("masks nested personal fields and tokens", () => {
    expect(
      redactSensitiveData({
        customer: {
          email: "person@example.com",
          phone: "07123456789",
        },
        shipping_address: {
          address1: "1 High Street",
          city: "London",
        },
        accessToken: "token-123",
        safe: {
          orderId: "order-1",
        },
      })
    ).toEqual({
      customer: "[REDACTED]",
      shipping_address: "[REDACTED]",
      accessToken: "[REDACTED]",
      safe: {
        orderId: "order-1",
      },
    });
  });
});
