import "server-only";

import { assertCJApiPointsAvailable, CJApiPointsError } from "@/services/cjdropshipping/apiPointGuard";
import { CJFetchError, cjFetchWithMeta } from "@/services/cjdropshipping/client";
import type { SupplierOrderStatusResult } from "@/suppliers/types";
import { acquireCJPermit } from "@/services/providers/cj/cjRateLimiter";
import {
  apiUsageFrom,
  CJOrderApiError,
  endpointWithExternalOrderId,
  getCJOrderEndpoint,
  sanitizeCJPayload,
} from "./types";
import { mapCJOrderStatus } from "./mapCJOrderStatus";

type CJOrderResponse = {
  code?: number;
  result?: boolean;
  success?: boolean;
  message?: string;
  requestId?: string;
  pointsInfo?: {
    usedToday?: number;
    remaining?: number;
    total?: number;
  };
  data?: {
    orderId?: string;
    orderNum?: string;
    orderStatus?: string;
    status?: string;
    paymentStatus?: string;
    payStatus?: string;
    parentOrderId?: string;
    paymentId?: string;
    trackingNumber?: string;
    trackNumber?: string;
    trackingUrl?: string;
  };
};

export async function getCJOrderStatus(
  externalOrderId: string
): Promise<SupplierOrderStatusResult> {
  const permit = await acquireCJPermit();

  if (!permit.granted) {
    throw new CJOrderApiError(
      `CJ rate-limit permit is unavailable for ${permit.retryAfterMs}ms.`,
      true
    );
  }

  const endpoint = endpointWithExternalOrderId(
    getCJOrderEndpoint("CJ_GET_ORDER_ENDPOINT"),
    externalOrderId
  );

  try {
    const { data, metadata } = await cjFetchWithMeta<CJOrderResponse>(endpoint, {
      method: "GET",
    });
    const apiUsage = apiUsageFrom({
      requestId: metadata.requestId || data.requestId,
      pointsInfo: metadata.pointsInfo || data.pointsInfo,
    });
    assertCJApiPointsAvailable(apiUsage?.remaining);

    const remoteStatus = data.data?.orderStatus || data.data?.status;
    const remotePaymentStatus =
      data.data?.paymentStatus || data.data?.payStatus;
    const mapped = mapCJOrderStatus(remoteStatus, remotePaymentStatus);

    return {
      success:
        data.success === true ||
        data.result === true ||
        data.code === 200,
      externalOrderId,
      status: mapped.status,
      paymentStatus: mapped.paymentStatus,
      remoteStatus,
      remotePaymentStatus,
      parentOrderId: data.data?.parentOrderId,
      paymentId: data.data?.paymentId,
      trackingNumber: data.data?.trackingNumber || data.data?.trackNumber,
      trackingUrl: data.data?.trackingUrl,
      requestId: metadata.requestId || data.requestId,
      apiUsage,
      checkedAt: new Date().toISOString(),
      retryable: data.code === 429 || (data.code !== undefined && data.code >= 500),
      message: data.message,
      raw: sanitizeCJPayload(data),
    };
  } catch (error) {
    if (error instanceof CJApiPointsError) {
      return {
        success: false,
        externalOrderId,
        status: "UNKNOWN",
        paymentStatus: "UNKNOWN",
        requestId: undefined,
        apiUsage: {
          remaining: error.remaining,
        },
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
        paymentStatus: "UNKNOWN",
        requestId: error.metadata.requestId,
        apiUsage: apiUsageFrom(error.metadata),
        checkedAt: new Date().toISOString(),
        retryable:
          error.status === 429 || error.status === 408 || error.status >= 500,
        message: error.message,
        raw: sanitizeCJPayload(error.data),
      };
    }

    throw error;
  }
}

export const getCJOrder = getCJOrderStatus;
