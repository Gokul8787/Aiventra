import "server-only";

import { cjFetch } from "./client";

export type CJInventoryInput = {
  productId: string;
  variantId?: string;
  quantity: number;
  warehouseId?: string;
};

export type CJInventoryResult = {
  availableQuantity: number;
  warehouseId?: string;
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

export async function getCJInventory(
  input: CJInventoryInput
): Promise<CJInventoryResult> {
  const endpoint =
    process.env.CJ_INVENTORY_ENDPOINT ||
    `/product/query?pid=${encodeURIComponent(input.productId)}`;

  const method = process.env.CJ_INVENTORY_ENDPOINT ? "POST" : "GET";
  const data = await cjFetch(endpoint, {
    method,
    body:
      method === "POST"
        ? JSON.stringify({
            productId: input.productId,
            variantId: input.variantId,
            quantity: input.quantity,
            warehouseId: input.warehouseId,
          })
        : undefined,
  });
  const result = unwrapCJData(data);
  const availableQuantity = toNumber(
    result.availableQuantity ??
      result.inventoryNum ??
      result.warehouseInventoryNum ??
      result.stock ??
      result.quantity
  );

  return {
    availableQuantity,
    warehouseId:
      typeof result.warehouseId === "string"
        ? result.warehouseId
        : input.warehouseId,
    raw: asRecord(data),
  };
}
