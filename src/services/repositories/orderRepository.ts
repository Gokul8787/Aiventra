import "server-only";

import type { TenantContext } from "@/context/storeContext";
import { tenantColumns } from "@/context/storeContext";
import type {
  CommerceOrder,
  CommerceOrderItem,
  OrderValidationResult,
} from "@/orders/types";
import { calculateOrderItemProfit } from "@/orders/mapping";
import type {
  CommerceOrderStatus,
  OrderValidationStatus,
  OrderItemFulfilmentStatus,
} from "@/orders/status";
import { redactSensitiveData } from "@/security/redactSensitiveData";
import { supabaseAdmin } from "@/services/supabase/admin";

export type ParsedOrderLineItem = {
  shopifyLineItemId: string;
  shopifyProductId?: string;
  shopifyVariantId?: string;
  title: string;
  sku?: string;
  quantity: number;
  price: number;
  rawData: Record<string, unknown>;
};

export type ParsedCommerceOrder = {
  shopifyOrderId: string;
  shopifyAdminGraphqlApiId?: string;
  shopifyOrderName?: string;
  orderNumber?: string;
  status: CommerceOrderStatus;
  financialStatus?: string;
  fulfilmentStatus?: string;
  currency: string;
  subtotal: number;
  shipping: number;
  tax: number;
  discount: number;
  total: number;
  placedAt?: string;
  cancelledAt?: string;
  refundedAt?: string;
  rawData: Record<string, unknown>;
  lineItems: ParsedOrderLineItem[];
};

type OrderRow = {
  id: string;
  organisation_id: string;
  store_id: string;
  customer_id: string | null;
  shopify_order_id: string;
  shopify_admin_graphql_api_id: string | null;
  shopify_order_name: string | null;
  order_number: string | null;
  status: CommerceOrderStatus;
  financial_status: string | null;
  fulfilment_status: string | null;
  currency: string;
  subtotal: number | string;
  shipping: number | string;
  tax: number | string;
  discount: number | string;
  total: number | string;
  validation_status: OrderValidationStatus;
  validation_decision: OrderValidationResult | null;
  placed_at: string | null;
  cancelled_at: string | null;
  refunded_at: string | null;
  created_at: string;
  updated_at: string;
};

type OrderItemRow = {
  id: string;
  order_id: string;
  product_id: string | null;
  shopify_line_item_id: string;
  shopify_product_id: string | null;
  shopify_variant_id: string | null;
  title: string;
  sku: string | null;
  quantity: number;
  price: number | string;
  cost: number | string | null;
  profit: number | string | null;
  supplier_id: string | null;
  supplier_product_id: string | null;
  fulfilment_status: CommerceOrderItem["fulfilmentStatus"];
};

type ProductRow = {
  id: string;
  supplier_price: number | string | null;
  provider: string | null;
  external_product_id: string | null;
  raw_data: {
    supplierSnapshot?: {
      supplierId?: string;
      externalProductId?: string;
    };
  } | null;
};

function toNumber(value: unknown) {
  const parsed = Number(value);

  return Number.isFinite(parsed) ? parsed : 0;
}

function numericShopifyId(value?: string) {
  if (!value) return undefined;

  return value.split("/").pop() || value;
}

function shopifyProductCandidates(value?: string) {
  const numeric = numericShopifyId(value);

  return Array.from(
    new Set([value, numeric, numeric ? `gid://shopify/Product/${numeric}` : undefined])
  ).filter(Boolean) as string[];
}

function shopifyVariantCandidates(value?: string) {
  const numeric = numericShopifyId(value);

  return Array.from(
    new Set([
      value,
      numeric,
      numeric ? `gid://shopify/ProductVariant/${numeric}` : undefined,
    ])
  ).filter(Boolean) as string[];
}

function mapOrder(row: OrderRow): CommerceOrder {
  return {
    id: row.id,
    organisationId: row.organisation_id,
    storeId: row.store_id,
    customerId: row.customer_id || undefined,
    shopifyOrderId: row.shopify_order_id,
    shopifyAdminGraphqlApiId: row.shopify_admin_graphql_api_id || undefined,
    shopifyOrderName: row.shopify_order_name || undefined,
    orderNumber: row.order_number || undefined,
    status: row.status,
    financialStatus: row.financial_status || undefined,
    fulfilmentStatus: row.fulfilment_status || undefined,
    currency: row.currency,
    subtotal: toNumber(row.subtotal),
    shipping: toNumber(row.shipping),
    tax: toNumber(row.tax),
    discount: toNumber(row.discount),
    total: toNumber(row.total),
    validationStatus: row.validation_status,
    validationDecision: row.validation_decision || undefined,
    placedAt: row.placed_at || undefined,
    cancelledAt: row.cancelled_at || undefined,
    refundedAt: row.refunded_at || undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapOrderItem(row: OrderItemRow): CommerceOrderItem {
  return {
    id: row.id,
    orderId: row.order_id,
    productId: row.product_id || undefined,
    shopifyLineItemId: row.shopify_line_item_id,
    shopifyProductId: row.shopify_product_id || undefined,
    shopifyVariantId: row.shopify_variant_id || undefined,
    title: row.title,
    sku: row.sku || undefined,
    quantity: row.quantity,
    price: toNumber(row.price),
    cost: row.cost == null ? undefined : toNumber(row.cost),
    profit: row.profit == null ? undefined : toNumber(row.profit),
    supplierId: row.supplier_id || undefined,
    supplierProductId: row.supplier_product_id || undefined,
    fulfilmentStatus: row.fulfilment_status,
  };
}

function deriveOrderStatusFromItems(
  statuses: OrderItemFulfilmentStatus[],
  fallbackStatus: CommerceOrderStatus
): {
  status: CommerceOrderStatus;
  fulfilmentStatus: string;
} {
  const actionableStatuses = statuses.filter(
    (status) => !["cancelled", "refunded"].includes(status)
  );

  if (!actionableStatuses.length) {
    return {
      status: "fulfilled",
      fulfilmentStatus: "fulfilled",
    };
  }

  if (actionableStatuses.every((status) => status === "fulfilled")) {
    return {
      status: "fulfilled",
      fulfilmentStatus: "fulfilled",
    };
  }

  if (actionableStatuses.some((status) => status === "fulfilled")) {
    return {
      status: "partially_fulfilled",
      fulfilmentStatus: "partially_fulfilled",
    };
  }

  return {
    status: fallbackStatus,
    fulfilmentStatus:
      fallbackStatus === "fulfilled" ? "fulfilled" : fallbackStatus,
  };
}

async function findProductById(
  tenantContext: TenantContext,
  productId: string
): Promise<ProductRow | null> {
  const { data, error } = await supabaseAdmin
    .from("products")
    .select("id, supplier_price, provider, external_product_id, raw_data")
    .eq("organisation_id", tenantContext.organisationId)
    .eq("store_id", tenantContext.storeId)
    .eq("id", productId)
    .maybeSingle<ProductRow>();

  if (error) {
    throw new Error(`Failed to load mapped product: ${error.message}`);
  }

  return data || null;
}

async function findMappedProduct(input: {
  tenantContext: TenantContext;
  shopifyProductId?: string;
  shopifyVariantId?: string;
}): Promise<ProductRow | null> {
  if (input.shopifyVariantId) {
    const variantIds = shopifyVariantCandidates(input.shopifyVariantId);
    const { data, error } = await supabaseAdmin
      .from("product_publications")
      .select("product_id")
      .eq("organisation_id", input.tenantContext.organisationId)
      .eq("store_id", input.tenantContext.storeId)
      .in("shopify_variant_id", variantIds)
      .limit(1)
      .maybeSingle<{ product_id: string }>();

    if (error) {
      throw new Error(`Failed to map Shopify variant: ${error.message}`);
    }

    if (data?.product_id) {
      return findProductById(input.tenantContext, data.product_id);
    }
  }

  if (!input.shopifyProductId) return null;

  const productIds = shopifyProductCandidates(input.shopifyProductId);
  const { data, error } = await supabaseAdmin
    .from("product_publications")
    .select("product_id")
    .eq("organisation_id", input.tenantContext.organisationId)
    .eq("store_id", input.tenantContext.storeId)
    .in("external_product_id", productIds)
    .limit(1)
    .maybeSingle<{ product_id: string }>();

  if (error) {
    throw new Error(`Failed to map Shopify product: ${error.message}`);
  }

  return data?.product_id
    ? findProductById(input.tenantContext, data.product_id)
    : null;
}

export async function saveOrderFromWebhook(input: {
  tenantContext: TenantContext;
  order: ParsedCommerceOrder;
  customerId?: string;
}): Promise<{
  order: CommerceOrder;
  items: CommerceOrderItem[];
}> {
  const now = new Date().toISOString();
  const orderRow = {
    ...tenantColumns(input.tenantContext),
    customer_id: input.customerId || null,
    shopify_order_id: input.order.shopifyOrderId,
    shopify_admin_graphql_api_id: input.order.shopifyAdminGraphqlApiId || null,
    shopify_order_name: input.order.shopifyOrderName || null,
    order_number: input.order.orderNumber || null,
    status: input.order.status,
    financial_status: input.order.financialStatus || null,
    fulfilment_status: input.order.fulfilmentStatus || null,
    currency: input.order.currency,
    subtotal: input.order.subtotal,
    shipping: input.order.shipping,
    tax: input.order.tax,
    discount: input.order.discount,
    total: input.order.total,
    placed_at: input.order.placedAt || null,
    cancelled_at: input.order.cancelledAt || null,
    refunded_at: input.order.refundedAt || null,
    raw_data: redactSensitiveData(input.order.rawData),
    updated_at: now,
  };

  const { data: savedOrder, error } = await supabaseAdmin
    .from("orders")
    .upsert(orderRow, {
      onConflict: "organisation_id,store_id,shopify_order_id",
    })
    .select("*")
    .single<OrderRow>();

  if (error || !savedOrder) {
    throw new Error(
      `Failed to save order: ${error?.message || "No order returned"}`
    );
  }

  const order = mapOrder(savedOrder);
  const itemRows = [];

  for (const lineItem of input.order.lineItems) {
    const mappedProduct = await findMappedProduct({
      tenantContext: input.tenantContext,
      shopifyProductId: lineItem.shopifyProductId,
      shopifyVariantId: lineItem.shopifyVariantId,
    });
    const cost =
      mappedProduct?.supplier_price == null
        ? undefined
        : toNumber(mappedProduct.supplier_price);

    itemRows.push({
      ...tenantColumns(input.tenantContext),
      order_id: order.id,
      product_id: mappedProduct?.id || null,
      shopify_line_item_id: lineItem.shopifyLineItemId,
      shopify_product_id: lineItem.shopifyProductId || null,
      shopify_variant_id: lineItem.shopifyVariantId || null,
      title: lineItem.title,
      sku: lineItem.sku || null,
      quantity: lineItem.quantity,
      price: lineItem.price,
      cost: cost ?? null,
      profit:
        cost == null
          ? null
          : calculateOrderItemProfit({
              price: lineItem.price,
              quantity: lineItem.quantity,
              cost,
            }),
      supplier_id:
        mappedProduct?.raw_data?.supplierSnapshot?.supplierId ||
        mappedProduct?.provider ||
        null,
      supplier_product_id:
        mappedProduct?.raw_data?.supplierSnapshot?.externalProductId ||
        mappedProduct?.external_product_id ||
        null,
      fulfilment_status: mappedProduct ? "pending" : "manual_review",
      raw_data: redactSensitiveData(lineItem.rawData),
      updated_at: now,
    });
  }

  const { data: savedItems, error: itemsError } = await supabaseAdmin
    .from("order_items")
    .upsert(itemRows, {
      onConflict: "organisation_id,store_id,shopify_line_item_id",
    })
    .select("*");

  if (itemsError) {
    throw new Error(`Failed to save order items: ${itemsError.message}`);
  }

  return {
    order,
    items: ((savedItems || []) as OrderItemRow[]).map(mapOrderItem),
  };
}

export async function getOrderItems(
  tenantContext: TenantContext,
  orderId: string
): Promise<CommerceOrderItem[]> {
  const { data, error } = await supabaseAdmin
    .from("order_items")
    .select("*")
    .eq("organisation_id", tenantContext.organisationId)
    .eq("store_id", tenantContext.storeId)
    .eq("order_id", orderId)
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error(`Failed to load order items: ${error.message}`);
  }

  return ((data || []) as OrderItemRow[]).map(mapOrderItem);
}

export async function getOrderById(
  tenantContext: TenantContext,
  orderId: string
): Promise<CommerceOrder | null> {
  const { data, error } = await supabaseAdmin
    .from("orders")
    .select("*")
    .eq("organisation_id", tenantContext.organisationId)
    .eq("store_id", tenantContext.storeId)
    .eq("id", orderId)
    .maybeSingle<OrderRow>();

  if (error) {
    throw new Error(`Failed to load order: ${error.message}`);
  }

  return data ? mapOrder(data) : null;
}

export async function getOrderByShopifyId(
  tenantContext: TenantContext,
  shopifyOrderId: string
): Promise<CommerceOrder | null> {
  const { data, error } = await supabaseAdmin
    .from("orders")
    .select("*")
    .eq("organisation_id", tenantContext.organisationId)
    .eq("store_id", tenantContext.storeId)
    .eq("shopify_order_id", shopifyOrderId)
    .maybeSingle<OrderRow>();

  if (error) {
    throw new Error(`Failed to load order: ${error.message}`);
  }

  return data ? mapOrder(data) : null;
}

export async function updateOrderStatus(input: {
  tenantContext: TenantContext;
  orderId: string;
  status: CommerceOrderStatus;
}): Promise<CommerceOrder | null> {
  const { data, error } = await supabaseAdmin
    .from("orders")
    .update({
      status: input.status,
      updated_at: new Date().toISOString(),
    })
    .eq("organisation_id", input.tenantContext.organisationId)
    .eq("store_id", input.tenantContext.storeId)
    .eq("id", input.orderId)
    .select("*")
    .maybeSingle<OrderRow>();

  if (error) {
    throw new Error(`Failed to update order status: ${error.message}`);
  }

  return data ? mapOrder(data) : null;
}

export async function markOrderFulfilled(input: {
  tenantContext: TenantContext;
  orderId: string;
}): Promise<CommerceOrder | null> {
  const items = await getOrderItems(input.tenantContext, input.orderId);

  return markOrderItemsFulfilled({
    tenantContext: input.tenantContext,
    orderId: input.orderId,
    orderItemIds: items.map((item) => item.id),
  });
}

export async function markOrderItemsFulfilled(input: {
  tenantContext: TenantContext;
  orderId: string;
  orderItemIds: string[];
}): Promise<CommerceOrder | null> {
  if (!input.orderItemIds.length) {
    return getOrderById(input.tenantContext, input.orderId);
  }

  const now = new Date().toISOString();

  const { error: itemError } = await supabaseAdmin
    .from("order_items")
    .update({
      fulfilment_status: "fulfilled",
      updated_at: now,
    })
    .eq("organisation_id", input.tenantContext.organisationId)
    .eq("store_id", input.tenantContext.storeId)
    .eq("order_id", input.orderId)
    .in("id", input.orderItemIds)
    .not("fulfilment_status", "in", "(cancelled,refunded)");

  if (itemError) {
    throw new Error(`Failed to update order items as fulfilled: ${itemError.message}`);
  }

  const refreshedItems = await getOrderItems(input.tenantContext, input.orderId);
  const currentOrder = await getOrderById(input.tenantContext, input.orderId);

  if (!currentOrder) {
    return null;
  }

  const nextState = deriveOrderStatusFromItems(
    refreshedItems.map((item) => item.fulfilmentStatus),
    currentOrder.status
  );

  const { data, error } = await supabaseAdmin
    .from("orders")
    .update({
      status: nextState.status,
      fulfilment_status: nextState.fulfilmentStatus,
      updated_at: now,
    })
    .eq("organisation_id", input.tenantContext.organisationId)
    .eq("store_id", input.tenantContext.storeId)
    .eq("id", input.orderId)
    .select("*")
    .maybeSingle<OrderRow>();

  if (error) {
    throw new Error(`Failed to update order fulfilment state: ${error.message}`);
  }

  return data ? mapOrder(data) : null;
}

export async function updateOrderStatusByShopifyId(input: {
  tenantContext: TenantContext;
  shopifyOrderId: string;
  status: CommerceOrderStatus;
  refundedAt?: string;
  cancelledAt?: string;
  rawData?: Record<string, unknown>;
}): Promise<CommerceOrder | null> {
  const updates: Record<string, unknown> = {
    status: input.status,
    updated_at: new Date().toISOString(),
  };

  if (input.refundedAt) updates.refunded_at = input.refundedAt;
  if (input.cancelledAt) updates.cancelled_at = input.cancelledAt;
  if (input.rawData) updates.raw_data = redactSensitiveData(input.rawData);

  const { data, error } = await supabaseAdmin
    .from("orders")
    .update(updates)
    .eq("organisation_id", input.tenantContext.organisationId)
    .eq("store_id", input.tenantContext.storeId)
    .eq("shopify_order_id", input.shopifyOrderId)
    .select("*")
    .maybeSingle<OrderRow>();

  if (error) {
    throw new Error(`Failed to update order status: ${error.message}`);
  }

  return data ? mapOrder(data) : null;
}

export async function listOrders(
  tenantContext: TenantContext,
  limit = 50
): Promise<CommerceOrder[]> {
  const { data, error } = await supabaseAdmin
    .from("orders")
    .select("*")
    .eq("organisation_id", tenantContext.organisationId)
    .eq("store_id", tenantContext.storeId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(`Failed to load orders: ${error.message}`);
  }

  return ((data || []) as OrderRow[]).map(mapOrder);
}

export async function saveOrderValidation(input: {
  tenantContext: TenantContext;
  orderId: string;
  jobId?: string;
  result: OrderValidationResult;
  validationStatus: OrderValidationStatus;
  orderStatus: CommerceOrderStatus;
}): Promise<void> {
  const { error: validationError } = await supabaseAdmin
    .from("order_validations")
    .insert({
      ...tenantColumns(input.tenantContext),
      order_id: input.orderId,
      job_id: input.jobId || null,
      decision: input.result.decision,
      confidence: input.result.confidence,
      reasons: input.result.reasons,
      blockers: input.result.blockers,
      checks: input.result.checks,
    });

  if (validationError) {
    throw new Error(`Failed to save order validation: ${validationError.message}`);
  }

  const { error: orderError } = await supabaseAdmin
    .from("orders")
    .update({
      validation_status: input.validationStatus,
      validation_decision: input.result,
      status: input.orderStatus,
      updated_at: new Date().toISOString(),
    })
    .eq("organisation_id", input.tenantContext.organisationId)
    .eq("store_id", input.tenantContext.storeId)
    .eq("id", input.orderId);

  if (orderError) {
    throw new Error(`Failed to update order validation: ${orderError.message}`);
  }
}

export async function getOrderValidations(
  tenantContext: TenantContext,
  orderId: string
): Promise<OrderValidationResult[]> {
  const { data, error } = await supabaseAdmin
    .from("order_validations")
    .select("decision, confidence, reasons, blockers, checks")
    .eq("organisation_id", tenantContext.organisationId)
    .eq("store_id", tenantContext.storeId)
    .eq("order_id", orderId)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(`Failed to load order validations: ${error.message}`);
  }

  return (data || []).map((row) => ({
    decision: row.decision,
    confidence: Number(row.confidence || 0),
    reasons: row.reasons || [],
    blockers: row.blockers || [],
    checks: row.checks,
  })) as OrderValidationResult[];
}

export async function getOrderEvents(
  tenantContext: TenantContext,
  orderId: string
): Promise<Array<{ id: string; eventType: string; createdAt: string; payload: Record<string, unknown> }>> {
  const { data, error } = await supabaseAdmin
    .from("domain_events")
    .select("id, event_type, payload, created_at")
    .eq("organisation_id", tenantContext.organisationId)
    .eq("store_id", tenantContext.storeId)
    .eq("aggregate_type", "order")
    .eq("aggregate_id", orderId)
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error(`Failed to load order events: ${error.message}`);
  }

  return (data || []).map((row) => ({
    id: row.id,
    eventType: row.event_type,
    createdAt: row.created_at,
    payload: row.payload || {},
  }));
}
