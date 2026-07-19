import "server-only";

import { assertCJApiPointsAvailable, CJApiPointsError } from "@/services/cjdropshipping/apiPointGuard";
import { CJFetchError, cjFetchWithMeta } from "@/services/cjdropshipping/client";
import { acquireCJPermit } from "@/services/providers/cj/cjRateLimiter";
import {
  apiUsageFrom,
  CJOrderApiError,
  CJOrderCreationInput,
  CJOrderCreationResult,
  getCJOrderEndpoint,
  sanitizeCJPayload,
  toCJNumber,
} from "./types";
import { mapCJOrderStatus } from "./mapCJOrderStatus";

function buildCreateOrderPayload(input: CJOrderCreationInput) {
  return {
    clientOrderReference: input.clientOrderReference,
    orderNumber: input.clientOrderReference,
    currency: input.currency,
    shippingMethodId: input.shippingMethodId,
    shippingAddress: {
      firstName: input.destination.firstName,
      lastName: input.destination.lastName,
      company: input.destination.company,
      address1: input.destination.address1,
      address2: input.destination.address2,
      city: input.destination.city,
      province: input.destination.province,
      postalCode: input.destination.postalCode,
      countryCode: input.destination.countryCode,
      phone: input.destination.phone,
      email: input.destination.email,
    },
    products: input.items.map((item) => ({
      orderItemId: item.orderItemId,
      productId: item.productId,
      variantId: item.variantId,
      sku: item.sku,
      quantity: item.quantity,
      price: item.unitPrice,
      currency: item.currency,
      shippingMethodId: item.shippingMethodId || input.shippingMethodId,
      warehouseId: item.warehouseId,
    })),
    metadata: input.metadata || {},
  };
}

function getResultRecord(data: unknown): Record<string, unknown> {
  if (!data || typeof data !== "object") return {};

  const record = data as Record<string, unknown>;
  const nested = record.data || record.result;

  return nested && typeof nested === "object"
    ? (nested as Record<string, unknown>)
    : record;
}

function assertCJSuccess(data: unknown, apiUsage: ReturnType<typeof apiUsageFrom>) {
  if (!data || typeof data !== "object") return;

  const record = data as Record<string, unknown>;
  const code = toCJNumber(record.code);
  const result = record.result;
  const message =
    typeof record.message === "string"
      ? record.message
      : typeof record.msg === "string"
        ? record.msg
        : "CJ order creation failed.";

  if ((code && code !== 200) || result === false) {
    throw new CJOrderApiError(
      message,
      code === 429 || code >= 500,
      sanitizeCJPayload(data),
      apiUsage
    );
  }
}

function calculateFallbackProductCost(input: CJOrderCreationInput) {
  return input.items.reduce(
    (sum, item) => sum + item.unitPrice * item.quantity,
    0
  );
}

export async function createCJOrder(
  input: CJOrderCreationInput
): Promise<CJOrderCreationResult> {
  const permit = await acquireCJPermit();

  if (!permit.granted) {
    throw new CJOrderApiError(
      `CJ rate-limit permit is unavailable for ${permit.retryAfterMs}ms.`,
      true
    );
  }

  const payload = buildCreateOrderPayload(input);
  const endpoint = getCJOrderEndpoint("CJ_CREATE_ORDER_ENDPOINT");

  try {
    const { data, metadata } = await cjFetchWithMeta<Record<string, unknown>>(
      endpoint,
      {
        method: "POST",
        body: JSON.stringify(payload),
      }
    );
    const apiUsage = apiUsageFrom(metadata);
    assertCJApiPointsAvailable(apiUsage?.remaining);

    assertCJSuccess(data, apiUsage);

    const result = getResultRecord(data);
    const orderId = String(
      result.orderId ||
        result.cjOrderId ||
        result.externalOrderId ||
        result.id ||
        ""
    );
    const productCost =
      toCJNumber(result.productCost || result.productAmount || result.goodsPrice) ||
      calculateFallbackProductCost(input);
    const shippingCost = toCJNumber(
      result.shippingCost || result.freight || result.logisticsPrice
    );
    const totalCost =
      toCJNumber(result.totalCost || result.amount || result.totalAmount) ||
      productCost + shippingCost;
    const mapped = mapCJOrderStatus(
      String(result.status || result.orderStatus || "AWAITING_PAYMENT"),
      String(result.paymentStatus || result.payStatus || "UNPAID")
    );

    return {
      success: Boolean(orderId),
      orderId: orderId || undefined,
      status: mapped.status,
      paymentRequired: true,
      productCost: Number(productCost.toFixed(2)),
      shippingCost: Number(shippingCost.toFixed(2)),
      totalCost: Number(totalCost.toFixed(2)),
      requestPayload: sanitizeCJPayload(payload),
      raw: sanitizeCJPayload(data),
      apiUsage,
      requestId: metadata.requestId,
    };
  } catch (error) {
    if (error instanceof CJApiPointsError) {
      throw new CJOrderApiError(
        error.message,
        false,
        sanitizeCJPayload(payload),
        {
          usedToday: undefined,
          remaining: error.remaining,
          total: undefined,
        }
      );
    }

    if (error instanceof CJFetchError) {
      throw new CJOrderApiError(
        error.message,
        error.status === 429 || error.status >= 500,
        sanitizeCJPayload(error.data),
        apiUsageFrom(error.metadata)
      );
    }

    throw error;
  }
}
