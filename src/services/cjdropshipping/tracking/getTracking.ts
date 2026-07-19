import "server-only";

import { acquireCJPermit } from "@/services/providers/cj/cjRateLimiter";
import type { SupplierTrackingResult } from "@/suppliers/types";
import {
  assertCJApiPointsAvailable,
  CJApiPointsError,
} from "@/services/cjdropshipping/apiPointGuard";
import { CJFetchError, cjFetchWithMeta } from "@/services/cjdropshipping/client";

import { mapCJTrackingResponse } from "./mapCJTracking";
import type { CJTrackingApiResponse } from "./types";

export async function getCJTracking(
  externalOrderId: string
): Promise<SupplierTrackingResult> {
  const permit = await acquireCJPermit();

  if (!permit.granted) {
    return {
      success: false,
      externalOrderId,
      status: "UNKNOWN",
      events: [],
      checkedAt: new Date().toISOString(),
      retryable: true,
      message: `CJ rate-limit permit is unavailable for ${permit.retryAfterMs}ms.`,
      raw: {},
    };
  }

  const endpoint = process.env.CJ_GET_TRACKING_ENDPOINT?.trim();

  if (!endpoint) {
    throw new Error("CJ_GET_TRACKING_ENDPOINT is not configured.");
  }

  const params = new URLSearchParams({
    orderId: externalOrderId,
  });
  const requestPath = `${endpoint}${endpoint.includes("?") ? "&" : "?"}${params.toString()}`;

  try {
    const { data, metadata } = await cjFetchWithMeta<CJTrackingApiResponse>(
      requestPath,
      {
        method: "GET",
      }
    );

    assertCJApiPointsAvailable(data.pointsInfo?.remaining, 1);

    return mapCJTrackingResponse({
      externalOrderId,
      response: {
        ...data,
        requestId: metadata.requestId || data.requestId,
        pointsInfo: (metadata.pointsInfo as CJTrackingApiResponse["pointsInfo"]) || data.pointsInfo,
      },
    });
  } catch (error) {
    if (error instanceof CJApiPointsError) {
      return {
        success: false,
        externalOrderId,
        status: "UNKNOWN",
        events: [],
        checkedAt: new Date().toISOString(),
        retryable: false,
        message: error.message,
        raw: {},
      };
    }

    if (error instanceof CJFetchError) {
      return {
        success: false,
        externalOrderId,
        status: "UNKNOWN",
        events: [],
        requestId: error.metadata.requestId,
        checkedAt: new Date().toISOString(),
        retryable:
          error.status === 429 || error.status === 408 || error.status >= 500,
        message: error.message,
        raw:
          error.data && typeof error.data === "object"
            ? (error.data as Record<string, unknown>)
            : {},
      };
    }

    throw error;
  }
}
