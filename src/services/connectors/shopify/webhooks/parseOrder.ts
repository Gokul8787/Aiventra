import "server-only";

import type {
  ParsedCommerceOrder,
  ParsedOrderLineItem,
} from "@/services/repositories/orderRepository";
import type { CommerceOrderStatus } from "@/orders/status";

type ShopifyAddress = {
  address1?: string;
  address2?: string;
  city?: string;
  province?: string;
  country?: string;
  country_code?: string;
  zip?: string;
};

type ShopifyCustomer = {
  id?: number | string;
  email?: string;
  first_name?: string;
  last_name?: string;
  phone?: string;
  default_address?: ShopifyAddress;
};

type ShopifyLineItem = {
  id?: number | string;
  product_id?: number | string;
  variant_id?: number | string;
  title?: string;
  name?: string;
  sku?: string;
  quantity?: number | string;
  price?: string;
  price_set?: {
    shop_money?: {
      amount?: string;
    };
  };
};

type ShopifyOrderPayload = {
  id?: number | string;
  admin_graphql_api_id?: string;
  name?: string;
  order_number?: number | string;
  email?: string;
  phone?: string;
  currency?: string;
  subtotal_price?: string;
  current_subtotal_price?: string;
  total_shipping_price_set?: {
    shop_money?: {
      amount?: string;
    };
  };
  shipping_lines?: Array<{ price?: string }>;
  total_tax?: string;
  current_total_tax?: string;
  total_discounts?: string;
  current_total_discounts?: string;
  total_price?: string;
  current_total_price?: string;
  financial_status?: string;
  fulfillment_status?: string | null;
  created_at?: string;
  processed_at?: string;
  cancelled_at?: string | null;
  customer?: ShopifyCustomer | null;
  billing_address?: ShopifyAddress | null;
  shipping_address?: ShopifyAddress | null;
  line_items?: ShopifyLineItem[];
};

function toNumber(value: unknown) {
  const parsed = Number(value);

  return Number.isFinite(parsed) ? parsed : 0;
}

function toStringId(value: unknown) {
  if (value === null || value === undefined) return undefined;

  return String(value);
}

function parseShipping(payload: ShopifyOrderPayload) {
  const explicit = payload.total_shipping_price_set?.shop_money?.amount;

  if (explicit !== undefined) return toNumber(explicit);

  return (payload.shipping_lines || []).reduce(
    (sum, line) => sum + toNumber(line.price),
    0
  );
}

export function parseShopifyCustomer(payload: ShopifyOrderPayload) {
  const customer = payload.customer || {};
  const address =
    customer.default_address ||
    payload.shipping_address ||
    payload.billing_address ||
    {};

  return {
    shopifyCustomerId: toStringId(customer.id),
    email: customer.email || payload.email,
    firstName: customer.first_name,
    lastName: customer.last_name,
    phone: customer.phone || payload.phone,
    address: address as Record<string, unknown>,
    rawData: (customer || {}) as Record<string, unknown>,
  };
}

export function parseShopifyOrder(
  payload: Record<string, unknown>,
  status: CommerceOrderStatus
): ParsedCommerceOrder {
  const order = payload as ShopifyOrderPayload;
  const shopifyOrderId = toStringId(order.id);

  if (!shopifyOrderId) {
    throw new Error("Shopify order payload is missing id.");
  }

  const lineItems: ParsedOrderLineItem[] = (order.line_items || []).map(
    (item) => {
      const lineItemId = toStringId(item.id);

      if (!lineItemId) {
        throw new Error("Shopify order line item is missing id.");
      }

      return {
        shopifyLineItemId: lineItemId,
        shopifyProductId: toStringId(item.product_id),
        shopifyVariantId: toStringId(item.variant_id),
        title: item.title || item.name || "Untitled item",
        sku: item.sku || undefined,
        quantity: toNumber(item.quantity || 1),
        price: toNumber(item.price_set?.shop_money?.amount || item.price),
        rawData: item as Record<string, unknown>,
      };
    }
  );

  return {
    shopifyOrderId,
    shopifyAdminGraphqlApiId: order.admin_graphql_api_id,
    shopifyOrderName: order.name,
    orderNumber:
      order.order_number === undefined ? undefined : String(order.order_number),
    status,
    financialStatus: order.financial_status,
    fulfilmentStatus: order.fulfillment_status || undefined,
    currency: order.currency || "GBP",
    subtotal: toNumber(order.current_subtotal_price || order.subtotal_price),
    shipping: parseShipping(order),
    tax: toNumber(order.current_total_tax || order.total_tax),
    discount: toNumber(
      order.current_total_discounts || order.total_discounts
    ),
    total: toNumber(order.current_total_price || order.total_price),
    placedAt: order.processed_at || order.created_at,
    cancelledAt: order.cancelled_at || undefined,
    rawData: payload,
    lineItems,
  };
}
