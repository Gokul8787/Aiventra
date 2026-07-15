import "server-only";

import { cjFetch } from "./client";

export type CJProductCostInput = {
  productId: string;
  variantId?: string;
  quantity: number;
  currency: string;
};

export type CJProductCostResult = {
  unitCost: number;
  currency: string;
  minimumQuantity?: number;
  raw: Record<string, unknown>;
};

function toNumber(value: unknown) {
  const parsed = Number(value);

  return Number.isFinite(parsed) ? parsed : 0;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : {};
}

function unwrapCJData(data: unknown): Record<string, unknown> {
  const root = asRecord(data);
  const nested = root.data ?? root.result;

  if (Array.isArray(nested)) {
    return asRecord(nested[0]);
  }

  return Object.keys(asRecord(nested)).length > 0 ? asRecord(nested) : root;
}

export async function getCJProductCost(
  input: CJProductCostInput
): Promise<CJProductCostResult> {
  const endpoint =
    process.env.CJ_PRODUCT_COST_ENDPOINT ||
    `/product/query?pid=${encodeURIComponent(input.productId)}`;

  const method = process.env.CJ_PRODUCT_COST_ENDPOINT ? "POST" : "GET";
  const data = await cjFetch(endpoint, {
    method,
    body:
      method === "POST"
        ? JSON.stringify({
            productId: input.productId,
            variantId: input.variantId,
            quantity: input.quantity,
            currency: input.currency,
          })
        : undefined,
  });
  const result = unwrapCJData(data);
  const unitCost = toNumber(
    result.unitCost ??
      result.nowPrice ??
      result.sellPrice ??
      result.discountPrice ??
      result.price
  );

  return {
    unitCost,
    currency:
      typeof result.currency === "string" ? result.currency : input.currency,
    minimumQuantity:
      result.minimumQuantity === undefined
        ? undefined
        : toNumber(result.minimumQuantity),
    raw: asRecord(data),
  };
}
