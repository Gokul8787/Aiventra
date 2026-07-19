import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { mocks } = vi.hoisted(() => ({
  mocks: {
    requireApiContext: vi.fn(),
    writeAuditLog: vi.fn(),
    getOrderById: vi.fn(),
    createCancellationRequest: vi.fn(),
    publishEvent: vi.fn(),
  },
}));

const { AuthenticationError, AuthorisationError } = vi.hoisted(() => {
  class LocalAuthenticationError extends Error {
    status = 401;
  }

  class LocalAuthorisationError extends Error {
    status = 403;
  }

  return {
    AuthenticationError: LocalAuthenticationError,
    AuthorisationError: LocalAuthorisationError,
  };
});

vi.mock("@/auth/requireApiContext", () => ({
  AuthenticationError,
  AuthorisationError,
  requireApiContext: mocks.requireApiContext,
}));
vi.mock("@/auth/apiErrorResponse", () => ({
  createApiErrorResponse: (error: unknown) =>
    new Response(
      JSON.stringify({
        success: false,
        message: error instanceof Error ? error.message : "Unexpected server error.",
      }),
      {
        status:
          error instanceof AuthenticationError
            ? 401
            : error instanceof AuthorisationError
              ? 403
              : 500,
        headers: {
          "content-type": "application/json",
        },
      }
    ),
}));
vi.mock("@/security/auditLogger", () => ({
  writeAuditLog: mocks.writeAuditLog,
}));
vi.mock("@/services/repositories/orderRepository", () => ({
  getOrderById: mocks.getOrderById,
}));
vi.mock("@/services/repositories/cancellationRepository", () => ({
  createCancellationRequest: mocks.createCancellationRequest,
}));
vi.mock("@/services/events/eventRepository", () => ({
  publishEvent: mocks.publishEvent,
}));

import { POST } from "../../app/api/orders/[id]/recovery/route";

describe("order recovery route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 or 403 for unauthorised requests", async () => {
    mocks.requireApiContext.mockRejectedValue(
      new AuthenticationError("Authentication is required.")
    );

    const response = await POST(
      new Request("http://localhost/api/orders/order-1/recovery", {
        method: "POST",
      }),
      {
        params: Promise.resolve({
          id: "order-1",
        }),
      }
    );

    expect([401, 403]).toContain(response.status);
  });
});
