import type {
  SupplierAddress,
  SupplierApiUsage,
  SupplierOrderStatus,
  SupplierPaymentStatus,
} from "@/suppliers/types";

export type CJOrderItemInput = {
  orderItemId: string;
  productId: string;
  variantId?: string;
  sku?: string;
  quantity: number;
  unitPrice: number;
  currency: string;
  shippingMethodId?: string;
  warehouseId?: string;
};

export type CJOrderCreationInput = {
  clientOrderReference: string;
  currency: string;
  destination: SupplierAddress;
  items: CJOrderItemInput[];
  shippingMethodId?: string;
  metadata?: Record<string, unknown>;
};

export type CJOrderCreationResult = {
  success: boolean;
  orderId?: string;
  status: SupplierOrderStatus;
  paymentRequired: boolean;
  productCost: number;
  shippingCost: number;
  totalCost: number;
  requestPayload: Record<string, unknown>;
  raw: Record<string, unknown>;
  apiUsage?: SupplierApiUsage;
  requestId?: string;
};

export type CJOrderStatusResult = {
  success: boolean;
  externalOrderId: string;
  status: SupplierOrderStatus;
  paymentStatus: SupplierPaymentStatus;
  remoteStatus?: string;
  remotePaymentStatus?: string;
  parentOrderId?: string;
  paymentId?: string;
  trackingNumber?: string;
  trackingUrl?: string;
  requestId?: string;
  raw: Record<string, unknown>;
  apiUsage?: SupplierApiUsage;
  checkedAt: string;
  retryable?: boolean;
  message?: string;
};

export type CJCancellationResult = {
  success: boolean;
  cancelled: boolean;
  externalOrderId?: string;
  status: SupplierOrderStatus;
  retryable?: boolean;
  message?: string;
  raw: Record<string, unknown>;
  apiUsage?: SupplierApiUsage;
};

export class CJOrderApiError extends Error {
  constructor(
    message: string,
    readonly retryable: boolean,
    readonly raw?: unknown,
    readonly apiUsage?: SupplierApiUsage
  ) {
    super(message);
    this.name = "CJOrderApiError";
  }
}

const REDACTED = "[REDACTED]";
const SENSITIVE_KEYS = new Set([
  "firstName",
  "lastName",
  "name",
  "fullName",
  "company",
  "address",
  "address1",
  "address2",
  "city",
  "province",
  "postalCode",
  "zip",
  "phone",
  "email",
  "token",
  "accessToken",
  "refreshToken",
]);

export function sanitizeCJPayload(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object") return {};

  return sanitizeValue(value) as Record<string, unknown>;
}

function sanitizeValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeValue(item));
  }

  if (!value || typeof value !== "object") return value;

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, child]) => [
      key,
      SENSITIVE_KEYS.has(key) ? REDACTED : sanitizeValue(child),
    ])
  );
}

export function toCJNumber(value: unknown) {
  const parsed = Number(value);

  return Number.isFinite(parsed) ? parsed : 0;
}

export function getCJOrderEndpoint(name: string) {
  const endpoint = process.env[name]?.trim();

  if (!endpoint) {
    throw new CJOrderApiError(
      `${name} is not configured. Configure the CJ order endpoint before enabling supplier order creation.`,
      false
    );
  }

  return endpoint;
}

export function endpointWithExternalOrderId(endpoint: string, externalOrderId: string) {
  if (endpoint.includes(":externalOrderId")) {
    return endpoint.replace(":externalOrderId", encodeURIComponent(externalOrderId));
  }

  if (endpoint.includes(":id")) {
    return endpoint.replace(":id", encodeURIComponent(externalOrderId));
  }

  const separator = endpoint.includes("?") ? "&" : "?";

  return `${endpoint}${separator}orderId=${encodeURIComponent(externalOrderId)}`;
}

export function apiUsageFrom(input: {
  requestId?: string;
  pointsInfo?: Record<string, unknown>;
}): SupplierApiUsage | undefined {
  if (!input.requestId && !input.pointsInfo) return undefined;

  const usedToday = toCJNumber(
    input.pointsInfo?.usedToday ??
      input.pointsInfo?.used ??
      input.pointsInfo?.cost ??
      input.pointsInfo?.consume
  );
  const remaining = toCJNumber(
    input.pointsInfo?.remaining ??
      input.pointsInfo?.remain ??
      input.pointsInfo?.balance
  );
  const total = toCJNumber(
    input.pointsInfo?.total ?? input.pointsInfo?.quota ?? input.pointsInfo?.limit
  );

  return {
    usedToday: usedToday || undefined,
    remaining: remaining || undefined,
    total: total || undefined,
    raw: input.pointsInfo,
  };
}

export function isRetryableCJError(error: unknown) {
  if (error instanceof CJOrderApiError) return error.retryable;

  const message = error instanceof Error ? error.message : String(error);

  return (
    message.includes("429") ||
    message.includes("408") ||
    message.includes("500") ||
    message.includes("502") ||
    message.includes("503") ||
    message.includes("504") ||
    message.toLowerCase().includes("timeout")
  );
}
