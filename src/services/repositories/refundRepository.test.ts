import { beforeEach, describe, expect, it, vi } from "vitest";

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
  persistRefund,
  recalculateOrderRefundStatus,
} from "./refundRepository";

function buildEqChain(result: unknown, error: unknown = null) {
  const maybeSingle = vi.fn().mockResolvedValue({ data: result, error });
  const single = vi.fn().mockResolvedValue({ data: result, error });
  const eqThird = vi.fn(() => ({ maybeSingle, single }));
  const eqSecond = vi.fn(() => ({ eq: eqThird, maybeSingle, single }));
  const eqFirst = vi.fn(() => ({ eq: eqSecond, maybeSingle, single }));

  return {
    chain: { eq: eqFirst, maybeSingle, single },
    eqFirst,
  };
}

describe("refundRepository", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns duplicate when the refund already exists", async () => {
    const existingChain = buildEqChain({ id: "refund-1" });
    supabaseAdminMock.from.mockReturnValueOnce({
      select: vi.fn(() => existingChain.chain),
    });

    const result = await persistRefund({
      organisationId: "org-1",
      storeId: "store-1",
      orderId: "order-1",
      platform: "shopify",
      externalRefundId: "shopify-refund-1",
      currency: "GBP",
      subtotalAmount: 10,
      taxAmount: 2,
      shippingAmount: 0,
      totalAmount: 12,
      items: [],
    });

    expect(result).toEqual({
      refundId: "refund-1",
      duplicate: true,
    });
  });

  it("marks an order as partially_refunded when part of the value is refunded", async () => {
    const orderSelect = {
      eq: vi.fn(() => ({
        single: vi.fn().mockResolvedValue({
          data: { id: "order-1", total: 100 },
          error: null,
        }),
      })),
    };
    const itemsSelect = {
      eq: vi.fn().mockResolvedValue({
        data: [{ quantity: 2 }],
        error: null,
      }),
    };
    const refundsSelect = {
      eq: vi.fn(() => ({
        eq: vi.fn().mockResolvedValue({
          data: [
            {
              total_amount: 40,
              refund_items: [{ quantity: 1 }],
            },
          ],
          error: null,
        }),
      })),
    };
    const updateEq = vi.fn().mockResolvedValue({ error: null });
    const updateChain = {
      update: vi.fn(() => ({
        eq: updateEq,
      })),
    };

    supabaseAdminMock.from
      .mockReturnValueOnce({ select: vi.fn(() => orderSelect) })
      .mockReturnValueOnce({ select: vi.fn(() => itemsSelect) })
      .mockReturnValueOnce({ select: vi.fn(() => refundsSelect) })
      .mockReturnValueOnce(updateChain);

    const summary = await recalculateOrderRefundStatus("order-1");

    expect(summary.status).toBe("partially_refunded");
    expect(updateChain.update).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "partially_refunded",
      })
    );
  });

  it("marks an order as refunded when all quantities are refunded", async () => {
    const orderSelect = {
      eq: vi.fn(() => ({
        single: vi.fn().mockResolvedValue({
          data: { id: "order-1", total: 100 },
          error: null,
        }),
      })),
    };
    const itemsSelect = {
      eq: vi.fn().mockResolvedValue({
        data: [{ quantity: 2 }],
        error: null,
      }),
    };
    const refundsSelect = {
      eq: vi.fn(() => ({
        eq: vi.fn().mockResolvedValue({
          data: [
            {
              total_amount: 90,
              refund_items: [{ quantity: 2 }],
            },
          ],
          error: null,
        }),
      })),
    };
    const updateEq = vi.fn().mockResolvedValue({ error: null });
    const updateChain = {
      update: vi.fn(() => ({
        eq: updateEq,
      })),
    };

    supabaseAdminMock.from
      .mockReturnValueOnce({ select: vi.fn(() => orderSelect) })
      .mockReturnValueOnce({ select: vi.fn(() => itemsSelect) })
      .mockReturnValueOnce({ select: vi.fn(() => refundsSelect) })
      .mockReturnValueOnce(updateChain);

    const summary = await recalculateOrderRefundStatus("order-1");

    expect(summary.status).toBe("refunded");
    expect(updateChain.update).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "refunded",
      })
    );
  });
});
