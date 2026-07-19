import "server-only";

import { CJFetchError, cjFetchWithMeta } from "@/services/cjdropshipping/client";
import { acquireCJPermit } from "@/services/providers/cj/cjRateLimiter";
import {
  apiUsageFrom,
  CJCancellationResult,
  CJOrderApiError,
  endpointWithExternalOrderId,
  getCJOrderEndpoint,
  sanitizeCJPayload,
} from "./types";
import { mapCJOrderStatus } from "./mapCJOrderStatus";

function resultRecord(data: unknown): Record<string, unknown> {
  if (!data || typeof data !== "object") return {};

  const record = data as Record<string, unknown>;
  const nested = record.data || record.result;

  return nested && typeof nested === "object"
    ? (nested as Record<string, unknown>)
    : record;
}

export async function cancelCJOrder(
  externalOrderId: string
): Promise<CJCancellationResult> {
  const permit = await acquireCJPermit();

  if (!permit.granted) {
    throw new CJOrderApiError(
      `CJ rate-limit permit is unavailable for ${permit.retryAfterMs}ms.`,
      true
    );
  }

  const endpoint = endpointWithExternalOrderId(
    getCJOrderEndpoint("CJ_CANCEL_ORDER_ENDPOINT"),
    externalOrderId
  );

  try {
    const { data, metadata } = await cjFetchWithMeta<Record<string, unknown>>(
      endpoint,
      {
        method: "POST",
        body: JSON.stringify({
          orderId: externalOrderId,
        }),
      }
    );
    const record = resultRecord(data);
    const success =
      record.result === true ||
      record.success === true ||
      String(record.code || "") === "200";

    return {
      success,
      cancelled: success,
      externalOrderId,
      status: success
        ? "CANCELLED"
        : mapCJOrderStatus(
            String(record.status || record.orderStatus || "FAILED"),
            String(record.paymentStatus || record.payStatus || "")
          ).status,
      retryable: false,
      message:
        typeof record.message === "string" ? record.message : undefined,
      raw: sanitizeCJPayload(data),
      apiUsage: apiUsageFrom(metadata),
    };
  } catch (error) {
    if (error instanceof CJFetchError) {
      throw new CJOrderApiError(
        error.message,
        error.status === 429 || error.status >= 500 || error.status === 408,
        sanitizeCJPayload(error.data),
        apiUsageFrom(error.metadata)
      );
    }

    throw error;
  }
}
