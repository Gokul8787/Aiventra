import "server-only";

import { cjFetch } from "./client";

export type CJShippingQuoteInput = {
  productId: string;
  variantId?: string;
  destinationCountry: string;
  quantity: number;
  postalCode?: string;
  currency?: string;
};

export type CJShippingQuote = {
  id: string;
  shippingCost: number;
  deliveryDays: number;
  currency: string;
  carrier?: string;
  raw: unknown;
};

function toNumber(value: unknown) {
  const parsed = Number(value);

  return Number.isFinite(parsed) ? parsed : 0;
}

function parseDeliveryDays(value: unknown) {
  if (typeof value === "number") return value;

  if (typeof value === "string") {
    const match = value.match(/\d+/);

    if (match) return Number(match[0]);
  }

  return 0;
}

export async function getCJShippingQuote(
  input: CJShippingQuoteInput
): Promise<CJShippingQuote> {
  const endpoint = process.env.CJ_SHIPPING_QUOTE_ENDPOINT;

  if (!endpoint) {
    throw new Error(
      "CJ shipping quote endpoint is not configured. Set CJ_SHIPPING_QUOTE_ENDPOINT before running CJ_SHIPPING_QUOTE jobs."
    );
  }

  const data = await cjFetch(endpoint, {
    method: "POST",
    body: JSON.stringify({
      productId: input.productId,
      variantId: input.variantId,
      countryCode: input.destinationCountry,
      postalCode: input.postalCode,
      quantity: input.quantity,
      currency: input.currency,
    }),
  });

  const result = (data?.data || data?.result || data) as Record<string, unknown>;

  return {
    id: String(result.id || crypto.randomUUID()),
    shippingCost: toNumber(
      result.shippingCost || result.freight || result.price || result.cost
    ),
    deliveryDays: parseDeliveryDays(
      result.deliveryDays || result.deliveryCycle || result.deliveryTime
    ),
    currency: String(result.currency || input.currency || "GBP"),
    carrier:
      typeof result.carrier === "string"
        ? result.carrier
        : typeof result.logisticsName === "string"
          ? result.logisticsName
          : undefined,
    raw: data,
  };
}
