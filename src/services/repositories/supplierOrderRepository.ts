import "server-only";

import type { TenantContext } from "@/context/storeContext";
import { tenantColumns } from "@/context/storeContext";
import { redactSensitiveData } from "@/security/redactSensitiveData";
import { supabaseAdmin } from "@/services/supabase/admin";
import type {
  SupplierPaymentStatus,
  SupplierProvider,
  SupplierOrderStatusResult,
  SupplierTrackingStatus,
} from "@/suppliers/types";

export type SupplierOrderStatus =
  | "PENDING"
  | "SUBMITTING"
  | "CREATED"
  | "AWAITING_PAYMENT"
  | "PAID"
  | "PROCESSING"
  | "SHIPPED"
  | "DELIVERED"
  | "CANCEL_REQUESTED"
  | "CANCELLED"
  | "FAILED"
  | "REVIEW_REQUIRED"
  | "UNKNOWN";

export type SupplierOrderRecord = {
  id: string;
  organisationId: string;
  storeId: string;
  orderId: string;
  supplierAccountId: string;
  provider: SupplierProvider;
  externalOrderId?: string;
  clientOrderReference: string;
  status: SupplierOrderStatus;
  paymentStatus: SupplierPaymentStatus;
  currency: string;
  productCost: number;
  shippingCost: number;
  totalCost: number;
  shippingMethod?: string;
  trackingNumber?: string;
  trackingUrl?: string;
  carrierCode?: string;
  carrierName?: string;
  trackingStatus?: SupplierTrackingStatus;
  remoteStatus?: string;
  remotePaymentStatus?: string;
  parentOrderId?: string;
  paymentId?: string;
  lastStatusSyncedAt?: string;
  nextStatusSyncAt?: string;
  statusSyncAttempts: number;
  providerRequestId?: string;
  apiPointsUsed?: number;
  apiPointsRemaining?: number;
  apiPointsTotal?: number;
  paymentApprovalRequired: boolean;
  paymentApprovedAt?: string;
  paymentApprovedBy?: string;
  lastTrackingSyncedAt?: string;
  nextTrackingSyncAt?: string;
  trackingSyncAttempts: number;
  idempotencyKey: string;
  requestPayload: Record<string, unknown>;
  responsePayload: Record<string, unknown>;
  attemptCount: number;
  lastError?: string;
  createdAt: string;
  submittedAt?: string;
  paidAt?: string;
  shippedAt?: string;
  cancelledAt?: string;
  updatedAt: string;
};

export type SupplierOrderItemInput = {
  orderItemId: string;
  productId?: string;
  supplierProductMappingId?: string;
  supplierProductId: string;
  supplierVariantId?: string;
  supplierSku?: string;
  warehouseId?: string;
  title: string;
  quantity: number;
  unitCost: number;
  shippingCost?: number;
  requestPayload?: Record<string, unknown>;
  responsePayload?: Record<string, unknown>;
};

export type SupplierOrderItemRecord = {
  orderItemId: string;
  quantity: number;
  supplierProductId: string;
};

export type SupplierOrderStatusSnapshotRecord = {
  id: string;
  supplierOrderId: string;
  provider: string;
  internalStatus: string;
  remoteStatus?: string;
  remotePaymentStatus?: string;
  externalOrderId?: string;
  parentOrderId?: string;
  paymentId?: string;
  providerRequestId?: string;
  apiPointsUsed?: number;
  apiPointsRemaining?: number;
  apiPointsTotal?: number;
  capturedAt: string;
};

export type SupplierPaymentApprovalRecord = {
  id: string;
  supplierOrderId: string;
  status: "pending" | "approved" | "rejected" | "expired";
  requestedAmount?: number;
  currency?: string;
  requestedAt: string;
  approvedBy?: string;
  approvedAt?: string;
  rejectedAt?: string;
  reason?: string;
};

type SupplierOrderRow = {
  id: string;
  organisation_id: string;
  store_id: string;
  order_id: string;
  supplier_account_id: string;
  provider: string;
  external_order_id: string | null;
  client_order_reference: string;
  status: SupplierOrderStatus;
  payment_status: SupplierPaymentStatus;
  currency: string;
  product_cost: number | string;
  shipping_cost: number | string;
  total_cost: number | string;
  shipping_method: string | null;
  tracking_number: string | null;
  tracking_url: string | null;
  carrier_code: string | null;
  carrier_name: string | null;
  tracking_status: SupplierTrackingStatus | null;
  remote_status: string | null;
  remote_payment_status: string | null;
  parent_order_id: string | null;
  payment_id: string | null;
  last_status_synced_at: string | null;
  next_status_sync_at: string | null;
  status_sync_attempts: number | string;
  provider_request_id: string | null;
  api_points_used: number | string | null;
  api_points_remaining: number | string | null;
  api_points_total: number | string | null;
  payment_approval_required: boolean | null;
  payment_approved_at: string | null;
  payment_approved_by: string | null;
  last_tracking_synced_at: string | null;
  next_tracking_sync_at: string | null;
  tracking_sync_attempts: number | string | null;
  idempotency_key: string;
  request_payload: Record<string, unknown> | null;
  response_payload: Record<string, unknown> | null;
  attempt_count: number | string;
  last_error: string | null;
  created_at: string;
  submitted_at: string | null;
  paid_at: string | null;
  shipped_at: string | null;
  cancelled_at: string | null;
  updated_at: string;
};

type SupplierOrderStatusSnapshotRow = {
  id: string;
  supplier_order_id: string;
  provider: string;
  internal_status: string;
  remote_status: string | null;
  remote_payment_status: string | null;
  external_order_id: string | null;
  parent_order_id: string | null;
  payment_id: string | null;
  provider_request_id: string | null;
  api_points_used: number | string | null;
  api_points_remaining: number | string | null;
  api_points_total: number | string | null;
  captured_at: string;
};

type SupplierPaymentApprovalRow = {
  id: string;
  supplier_order_id: string;
  status: "pending" | "approved" | "rejected" | "expired";
  requested_amount: number | string | null;
  currency: string | null;
  requested_at: string;
  approved_by: string | null;
  approved_at: string | null;
  rejected_at: string | null;
  reason: string | null;
};

function toNumber(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function mapSupplierOrder(row: SupplierOrderRow): SupplierOrderRecord {
  return {
    id: row.id,
    organisationId: row.organisation_id,
    storeId: row.store_id,
    orderId: row.order_id,
    supplierAccountId: row.supplier_account_id,
    provider: row.provider as SupplierProvider,
    externalOrderId: row.external_order_id || undefined,
    clientOrderReference: row.client_order_reference,
    status: row.status,
    paymentStatus: row.payment_status,
    currency: row.currency,
    productCost: toNumber(row.product_cost),
    shippingCost: toNumber(row.shipping_cost),
    totalCost: toNumber(row.total_cost),
    shippingMethod: row.shipping_method || undefined,
    trackingNumber: row.tracking_number || undefined,
    trackingUrl: row.tracking_url || undefined,
    carrierCode: row.carrier_code || undefined,
    carrierName: row.carrier_name || undefined,
    trackingStatus: row.tracking_status || undefined,
    remoteStatus: row.remote_status || undefined,
    remotePaymentStatus: row.remote_payment_status || undefined,
    parentOrderId: row.parent_order_id || undefined,
    paymentId: row.payment_id || undefined,
    lastStatusSyncedAt: row.last_status_synced_at || undefined,
    nextStatusSyncAt: row.next_status_sync_at || undefined,
    statusSyncAttempts: Number(row.status_sync_attempts || 0),
    providerRequestId: row.provider_request_id || undefined,
    apiPointsUsed:
      row.api_points_used == null ? undefined : toNumber(row.api_points_used),
    apiPointsRemaining:
      row.api_points_remaining == null
        ? undefined
        : toNumber(row.api_points_remaining),
    apiPointsTotal:
      row.api_points_total == null ? undefined : toNumber(row.api_points_total),
    paymentApprovalRequired: row.payment_approval_required !== false,
    paymentApprovedAt: row.payment_approved_at || undefined,
    paymentApprovedBy: row.payment_approved_by || undefined,
    lastTrackingSyncedAt: row.last_tracking_synced_at || undefined,
    nextTrackingSyncAt: row.next_tracking_sync_at || undefined,
    trackingSyncAttempts: Number(row.tracking_sync_attempts || 0),
    idempotencyKey: row.idempotency_key,
    requestPayload: row.request_payload || {},
    responsePayload: row.response_payload || {},
    attemptCount: Number(row.attempt_count || 0),
    lastError: row.last_error || undefined,
    createdAt: row.created_at,
    submittedAt: row.submitted_at || undefined,
    paidAt: row.paid_at || undefined,
    shippedAt: row.shipped_at || undefined,
    cancelledAt: row.cancelled_at || undefined,
    updatedAt: row.updated_at,
  };
}

function mapSupplierOrderStatusSnapshot(
  row: SupplierOrderStatusSnapshotRow
): SupplierOrderStatusSnapshotRecord {
  return {
    id: row.id,
    supplierOrderId: row.supplier_order_id,
    provider: row.provider,
    internalStatus: row.internal_status,
    remoteStatus: row.remote_status || undefined,
    remotePaymentStatus: row.remote_payment_status || undefined,
    externalOrderId: row.external_order_id || undefined,
    parentOrderId: row.parent_order_id || undefined,
    paymentId: row.payment_id || undefined,
    providerRequestId: row.provider_request_id || undefined,
    apiPointsUsed:
      row.api_points_used == null ? undefined : toNumber(row.api_points_used),
    apiPointsRemaining:
      row.api_points_remaining == null
        ? undefined
        : toNumber(row.api_points_remaining),
    apiPointsTotal:
      row.api_points_total == null ? undefined : toNumber(row.api_points_total),
    capturedAt: row.captured_at,
  };
}

function mapSupplierPaymentApproval(
  row: SupplierPaymentApprovalRow
): SupplierPaymentApprovalRecord {
  return {
    id: row.id,
    supplierOrderId: row.supplier_order_id,
    status: row.status,
    requestedAmount:
      row.requested_amount == null ? undefined : toNumber(row.requested_amount),
    currency: row.currency || undefined,
    requestedAt: row.requested_at,
    approvedBy: row.approved_by || undefined,
    approvedAt: row.approved_at || undefined,
    rejectedAt: row.rejected_at || undefined,
    reason: row.reason || undefined,
  };
}

function calculateProductCost(items: SupplierOrderItemInput[]) {
  return items.reduce((sum, item) => sum + item.unitCost * item.quantity, 0);
}

function calculateShippingCost(items: SupplierOrderItemInput[]) {
  return items.reduce((sum, item) => sum + (item.shippingCost || 0), 0);
}

async function saveSupplierOrderItems(input: {
  context: TenantContext;
  supplierOrderId: string;
  items: SupplierOrderItemInput[];
}) {
  if (!input.items.length) return;

  const { error } = await supabaseAdmin.from("supplier_order_items").upsert(
    input.items.map((item) => ({
      ...tenantColumns(input.context),
      supplier_order_id: input.supplierOrderId,
      order_item_id: item.orderItemId,
      product_id: item.productId || null,
      supplier_product_mapping_id: item.supplierProductMappingId || null,
      supplier_product_id: item.supplierProductId,
      supplier_variant_id: item.supplierVariantId || null,
      supplier_sku: item.supplierSku || null,
      warehouse_id: item.warehouseId || null,
      title: item.title,
      quantity: item.quantity,
      unit_cost: item.unitCost,
      shipping_cost: item.shippingCost || 0,
      total_cost: Number(
        (item.unitCost * item.quantity + (item.shippingCost || 0)).toFixed(2)
      ),
      request_payload: redactSensitiveData(item.requestPayload || {}),
      response_payload: redactSensitiveData(item.responsePayload || {}),
      updated_at: new Date().toISOString(),
    })),
    {
      onConflict: "supplier_order_id,order_item_id",
    }
  );

  if (error) {
    throw new Error(`Failed to save supplier order items: ${error.message}`);
  }
}

export async function createPendingSupplierOrder(input: {
  context: TenantContext;
  orderId: string;
  supplierAccountId: string;
  provider: SupplierProvider;
  clientOrderReference: string;
  currency: string;
  idempotencyKey: string;
  items: SupplierOrderItemInput[];
  shippingMethod?: string;
  requestPayload?: Record<string, unknown>;
}): Promise<SupplierOrderRecord> {
  const productCost = calculateProductCost(input.items);
  const shippingCost = calculateShippingCost(input.items);
  const totalCost = productCost + shippingCost;
  const { data, error } = await supabaseAdmin
    .from("supplier_orders")
    .upsert(
      {
        ...tenantColumns(input.context),
        order_id: input.orderId,
        supplier_account_id: input.supplierAccountId,
        provider: input.provider,
        client_order_reference: input.clientOrderReference,
        status: "PENDING",
        payment_status: "UNPAID",
        currency: input.currency,
        product_cost: Number(productCost.toFixed(2)),
        shipping_cost: Number(shippingCost.toFixed(2)),
        total_cost: Number(totalCost.toFixed(2)),
        shipping_method: input.shippingMethod || null,
        idempotency_key: input.idempotencyKey,
        request_payload: redactSensitiveData(input.requestPayload || {}),
        updated_at: new Date().toISOString(),
      },
      {
        onConflict: "store_id,order_id,supplier_account_id",
      }
    )
    .select("*")
    .single<SupplierOrderRow>();

  if (error || !data) {
    throw new Error(
      `Failed to create pending supplier order: ${
        error?.message || "No row returned"
      }`
    );
  }

  await saveSupplierOrderItems({
    context: input.context,
    supplierOrderId: data.id,
    items: input.items,
  });

  return mapSupplierOrder(data);
}

export async function claimSupplierOrderForSubmission(
  context: TenantContext,
  supplierOrderId: string
): Promise<SupplierOrderRecord | null> {
  const { data, error } = await supabaseAdmin
    .from("supplier_orders")
    .update({
      status: "SUBMITTING",
      attempt_count: 1,
      last_error: null,
      updated_at: new Date().toISOString(),
    })
    .eq("organisation_id", context.organisationId)
    .eq("store_id", context.storeId)
    .eq("id", supplierOrderId)
    .eq("status", "PENDING")
    .select("*")
    .maybeSingle<SupplierOrderRow>();

  if (error) {
    throw new Error(`Failed to claim supplier order: ${error.message}`);
  }

  return data ? mapSupplierOrder(data) : null;
}

export async function markSupplierOrderCreated(input: {
  context: TenantContext;
  supplierOrderId: string;
  externalOrderId: string;
  productCost: number;
  shippingCost: number;
  totalCost: number;
  responsePayload?: Record<string, unknown>;
}): Promise<SupplierOrderRecord> {
  const { data, error } = await supabaseAdmin
    .from("supplier_orders")
    .update({
      status: "CREATED",
      external_order_id: input.externalOrderId,
      product_cost: input.productCost,
      shipping_cost: input.shippingCost,
      total_cost: input.totalCost,
      response_payload: redactSensitiveData(input.responsePayload || {}),
      submitted_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("organisation_id", input.context.organisationId)
    .eq("store_id", input.context.storeId)
    .eq("id", input.supplierOrderId)
    .select("*")
    .single<SupplierOrderRow>();

  if (error || !data) {
    throw new Error(
      `Failed to mark supplier order created: ${
        error?.message || "No row returned"
      }`
    );
  }

  return mapSupplierOrder(data);
}

export async function markSupplierOrderAwaitingPayment(input: {
  context: TenantContext;
  supplierOrderId: string;
  responsePayload?: Record<string, unknown>;
}): Promise<SupplierOrderRecord> {
  const { data, error } = await supabaseAdmin
    .from("supplier_orders")
    .update({
      status: "AWAITING_PAYMENT",
      payment_status: "UNPAID",
      response_payload: redactSensitiveData(input.responsePayload || {}),
      updated_at: new Date().toISOString(),
    })
    .eq("organisation_id", input.context.organisationId)
    .eq("store_id", input.context.storeId)
    .eq("id", input.supplierOrderId)
    .select("*")
    .single<SupplierOrderRow>();

  if (error || !data) {
    throw new Error(
      `Failed to mark supplier order awaiting payment: ${
        error?.message || "No row returned"
      }`
    );
  }

  return mapSupplierOrder(data);
}

export async function markSupplierOrderFailed(input: {
  context: TenantContext;
  supplierOrderId: string;
  errorMessage: string;
  responsePayload?: Record<string, unknown>;
}): Promise<void> {
  const { error } = await supabaseAdmin
    .from("supplier_orders")
    .update({
      status: "FAILED",
      last_error: input.errorMessage,
      response_payload: redactSensitiveData(input.responsePayload || {}),
      updated_at: new Date().toISOString(),
    })
    .eq("organisation_id", input.context.organisationId)
    .eq("store_id", input.context.storeId)
    .eq("id", input.supplierOrderId);

  if (error) {
    throw new Error(`Failed to mark supplier order failed: ${error.message}`);
  }
}

export async function markSupplierOrderReviewRequired(input: {
  context: TenantContext;
  supplierOrderId: string;
  reason: string;
  responsePayload?: Record<string, unknown>;
}): Promise<void> {
  const { error } = await supabaseAdmin
    .from("supplier_orders")
    .update({
      status: "REVIEW_REQUIRED",
      last_error: input.reason,
      response_payload: redactSensitiveData(input.responsePayload || {}),
      updated_at: new Date().toISOString(),
    })
    .eq("organisation_id", input.context.organisationId)
    .eq("store_id", input.context.storeId)
    .eq("id", input.supplierOrderId);

  if (error) {
    throw new Error(
      `Failed to mark supplier order review required: ${error.message}`
    );
  }
}

export async function getSupplierOrderByOrderId(
  context: TenantContext,
  orderId: string
): Promise<SupplierOrderRecord | null> {
  const { data, error } = await supabaseAdmin
    .from("supplier_orders")
    .select("*")
    .eq("organisation_id", context.organisationId)
    .eq("store_id", context.storeId)
    .eq("order_id", orderId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle<SupplierOrderRow>();

  if (error) {
    throw new Error(`Failed to load supplier order: ${error.message}`);
  }

  return data ? mapSupplierOrder(data) : null;
}

export async function getSupplierOrderById(
  context: TenantContext,
  supplierOrderId: string
): Promise<SupplierOrderRecord | null> {
  const { data, error } = await supabaseAdmin
    .from("supplier_orders")
    .select("*")
    .eq("organisation_id", context.organisationId)
    .eq("store_id", context.storeId)
    .eq("id", supplierOrderId)
    .maybeSingle<SupplierOrderRow>();

  if (error) {
    throw new Error(`Failed to load supplier order: ${error.message}`);
  }

  return data ? mapSupplierOrder(data) : null;
}

export async function getSupplierOrdersForOrder(
  context: TenantContext,
  orderId: string
): Promise<SupplierOrderRecord[]> {
  const { data, error } = await supabaseAdmin
    .from("supplier_orders")
    .select("*")
    .eq("organisation_id", context.organisationId)
    .eq("store_id", context.storeId)
    .eq("order_id", orderId)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(`Failed to load supplier orders: ${error.message}`);
  }

  return ((data || []) as SupplierOrderRow[]).map(mapSupplierOrder);
}

export async function listSupplierOrderItems(
  context: TenantContext,
  supplierOrderId: string
): Promise<SupplierOrderItemRecord[]> {
  const { data, error } = await supabaseAdmin
    .from("supplier_order_items")
    .select("order_item_id, quantity, supplier_product_id")
    .eq("organisation_id", context.organisationId)
    .eq("store_id", context.storeId)
    .eq("supplier_order_id", supplierOrderId);

  if (error) {
    throw new Error(`Failed to load supplier order items: ${error.message}`);
  }

  return ((data || []) as Array<{
    order_item_id: string;
    quantity: number | string;
    supplier_product_id: string;
  }>).map((row) => ({
    orderItemId: row.order_item_id,
    quantity: toNumber(row.quantity || 0),
    supplierProductId: row.supplier_product_id,
  }));
}

export async function getSupplierOrderByExternalId(
  context: TenantContext,
  provider: SupplierProvider,
  externalOrderId: string
): Promise<SupplierOrderRecord | null> {
  const { data, error } = await supabaseAdmin
    .from("supplier_orders")
    .select("*")
    .eq("organisation_id", context.organisationId)
    .eq("store_id", context.storeId)
    .eq("provider", provider)
    .eq("external_order_id", externalOrderId)
    .maybeSingle<SupplierOrderRow>();

  if (error) {
    throw new Error(
      `Failed to load supplier order by external ID: ${error.message}`
    );
  }

  return data ? mapSupplierOrder(data) : null;
}

export async function appendSupplierOrderEvent(input: {
  context: TenantContext;
  supplierOrderId: string;
  eventType: string;
  message?: string;
  payload?: Record<string, unknown>;
  createdBy?: string;
}): Promise<void> {
  const { error } = await supabaseAdmin.from("supplier_order_events").insert({
    ...tenantColumns(input.context),
    supplier_order_id: input.supplierOrderId,
    event_type: input.eventType,
    message: input.message || null,
    payload: redactSensitiveData(input.payload || {}),
    created_by: input.createdBy || "system",
  });

  if (error) {
    throw new Error(`Failed to append supplier order event: ${error.message}`);
  }
}

export async function markSupplierOrderCancelled(input: {
  context: TenantContext;
  supplierOrderId: string;
  responsePayload?: Record<string, unknown>;
}): Promise<void> {
  const now = new Date().toISOString();
  const { error } = await supabaseAdmin
    .from("supplier_orders")
    .update({
      status: "CANCELLED",
      cancelled_at: now,
      response_payload: redactSensitiveData(input.responsePayload || {}),
      updated_at: now,
    })
    .eq("organisation_id", input.context.organisationId)
    .eq("store_id", input.context.storeId)
    .eq("id", input.supplierOrderId);

  if (error) {
    throw new Error(`Failed to mark supplier order cancelled: ${error.message}`);
  }
}

export async function saveSupplierOrderStatusSnapshot(input: {
  organisationId: string;
  storeId: string;
  supplierOrderId: string;
  provider: string;
  result: SupplierOrderStatusResult;
}): Promise<void> {
  const { error } = await supabaseAdmin
    .from("supplier_order_status_snapshots")
    .insert({
      organisation_id: input.organisationId,
      store_id: input.storeId,
      supplier_order_id: input.supplierOrderId,
      provider: input.provider,
      internal_status: input.result.status,
      remote_status: input.result.remoteStatus || null,
      remote_payment_status: input.result.remotePaymentStatus || null,
      external_order_id: input.result.externalOrderId,
      parent_order_id: input.result.parentOrderId || null,
      payment_id: input.result.paymentId || null,
      provider_request_id: input.result.requestId || null,
      api_points_used: input.result.apiUsage?.usedToday ?? null,
      api_points_remaining: input.result.apiUsage?.remaining ?? null,
      api_points_total: input.result.apiUsage?.total ?? null,
      raw_response: redactSensitiveData(input.result.raw || {}),
      captured_at: input.result.checkedAt,
    });

  if (error) {
    throw new Error(
      `Failed to save supplier order status snapshot: ${error.message}`
    );
  }
}

export async function updateSupplierOrderFromStatus(input: {
  context: TenantContext;
  supplierOrderId: string;
  result: SupplierOrderStatusResult;
  nextStatusSyncAt?: string;
}): Promise<void> {
  const now = new Date().toISOString();
  const update: Record<string, unknown> = {
    status: input.result.status,
    payment_status: input.result.paymentStatus,
    remote_status: input.result.remoteStatus || null,
    remote_payment_status: input.result.remotePaymentStatus || null,
    parent_order_id: input.result.parentOrderId || null,
    payment_id: input.result.paymentId || null,
    tracking_number: input.result.trackingNumber || null,
    tracking_url: input.result.trackingUrl || null,
    provider_request_id: input.result.requestId || null,
    api_points_used: input.result.apiUsage?.usedToday ?? null,
    api_points_remaining: input.result.apiUsage?.remaining ?? null,
    api_points_total: input.result.apiUsage?.total ?? null,
    last_status_synced_at: now,
    next_status_sync_at: input.nextStatusSyncAt || null,
    status_sync_attempts: 0,
    updated_at: now,
    response_payload: redactSensitiveData(input.result.raw || {}),
  };

  if (input.result.status === "PAID") update.paid_at = now;
  if (input.result.status === "SHIPPED") update.shipped_at = now;
  if (input.result.status === "CANCELLED") update.cancelled_at = now;

  const { error } = await supabaseAdmin
    .from("supplier_orders")
    .update(update)
    .eq("organisation_id", input.context.organisationId)
    .eq("store_id", input.context.storeId)
    .eq("id", input.supplierOrderId);

  if (error) {
    throw new Error(
      `Failed to update supplier order status: ${error.message}`
    );
  }
}

export async function updateSupplierOrderTracking(input: {
  context: TenantContext;
  supplierOrderId: string;
  trackingNumber?: string;
  trackingUrl?: string;
  carrierCode?: string;
  carrierName?: string;
  trackingStatus?: SupplierTrackingStatus;
  shippedAt?: string;
  deliveredAt?: string;
  lastTrackingSyncedAt: string;
  nextTrackingSyncAt?: string;
  responsePayload?: Record<string, unknown>;
}): Promise<void> {
  const update: Record<string, unknown> = {
    tracking_number: input.trackingNumber || null,
    tracking_url: input.trackingUrl || null,
    carrier_code: input.carrierCode || null,
    carrier_name: input.carrierName || null,
    tracking_status: input.trackingStatus || null,
    last_tracking_synced_at: input.lastTrackingSyncedAt,
    next_tracking_sync_at: input.nextTrackingSyncAt || null,
    tracking_sync_attempts: 0,
    updated_at: new Date().toISOString(),
  };

  if (input.shippedAt) {
    update.shipped_at = input.shippedAt;
  }

  if (input.deliveredAt) {
    update.delivered_at = input.deliveredAt;
  }

  if (input.responsePayload) {
    update.response_payload = redactSensitiveData(input.responsePayload);
  }

  const { error } = await supabaseAdmin
    .from("supplier_orders")
    .update(update)
    .eq("organisation_id", input.context.organisationId)
    .eq("store_id", input.context.storeId)
    .eq("id", input.supplierOrderId);

  if (error) {
    throw new Error(`Failed to update supplier tracking: ${error.message}`);
  }
}

export async function listSupplierOrderStatusSnapshots(
  context: TenantContext,
  supplierOrderId: string
): Promise<SupplierOrderStatusSnapshotRecord[]> {
  const { data, error } = await supabaseAdmin
    .from("supplier_order_status_snapshots")
    .select(
      "id, supplier_order_id, provider, internal_status, remote_status, remote_payment_status, external_order_id, parent_order_id, payment_id, provider_request_id, api_points_used, api_points_remaining, api_points_total, captured_at"
    )
    .eq("organisation_id", context.organisationId)
    .eq("store_id", context.storeId)
    .eq("supplier_order_id", supplierOrderId)
    .order("captured_at", { ascending: false });

  if (error) {
    throw new Error(
      `Failed to load supplier order status snapshots: ${error.message}`
    );
  }

  return ((data || []) as SupplierOrderStatusSnapshotRow[]).map(
    mapSupplierOrderStatusSnapshot
  );
}

export async function upsertSupplierPaymentApproval(input: {
  context: TenantContext;
  supplierOrderId: string;
  requestedAmount?: number;
  currency?: string;
  reason?: string;
}): Promise<SupplierPaymentApprovalRecord> {
  const existing = await getSupplierPaymentApprovalBySupplierOrderId({
    context: input.context,
    supplierOrderId: input.supplierOrderId,
  });

  if (existing?.status === "approved") {
    return existing;
  }

  const { data, error } = await supabaseAdmin
    .from("supplier_payment_approvals")
    .upsert(
      {
        ...tenantColumns(input.context),
        supplier_order_id: input.supplierOrderId,
        status: "pending",
        requested_amount: input.requestedAmount ?? null,
        currency: input.currency || null,
        reason: input.reason || null,
      },
      {
        onConflict: "supplier_order_id",
      }
    )
    .select(
      "id, supplier_order_id, status, requested_amount, currency, requested_at, approved_by, approved_at, rejected_at, reason"
    )
    .single<SupplierPaymentApprovalRow>();

  if (error || !data) {
    throw new Error(
      `Failed to upsert supplier payment approval: ${
        error?.message || "No row returned"
      }`
    );
  }

  return mapSupplierPaymentApproval(data);
}

export async function getSupplierPaymentApprovalBySupplierOrderId(input: {
  context: TenantContext;
  supplierOrderId: string;
}): Promise<SupplierPaymentApprovalRecord | null> {
  const { data, error } = await supabaseAdmin
    .from("supplier_payment_approvals")
    .select(
      "id, supplier_order_id, status, requested_amount, currency, requested_at, approved_by, approved_at, rejected_at, reason"
    )
    .eq("organisation_id", input.context.organisationId)
    .eq("store_id", input.context.storeId)
    .eq("supplier_order_id", input.supplierOrderId)
    .maybeSingle<SupplierPaymentApprovalRow>();

  if (error) {
    throw new Error(
      `Failed to load supplier payment approval: ${error.message}`
    );
  }

  return data ? mapSupplierPaymentApproval(data) : null;
}

export async function approveSupplierPaymentApproval(input: {
  context: TenantContext;
  supplierOrderId: string;
  approvedBy: string;
  reason?: string;
}): Promise<SupplierPaymentApprovalRecord> {
  const { data, error } = await supabaseAdmin
    .from("supplier_payment_approvals")
    .update({
      status: "approved",
      approved_by: input.approvedBy,
      approved_at: new Date().toISOString(),
      reason: input.reason || null,
    })
    .eq("organisation_id", input.context.organisationId)
    .eq("store_id", input.context.storeId)
    .eq("supplier_order_id", input.supplierOrderId)
    .eq("status", "pending")
    .select(
      "id, supplier_order_id, status, requested_amount, currency, requested_at, approved_by, approved_at, rejected_at, reason"
    )
    .single<SupplierPaymentApprovalRow>();

  if (error || !data) {
    throw new Error(
      `Failed to approve supplier payment approval: ${
        error?.message || "No row returned"
      }`
    );
  }

  const { error: supplierOrderError } = await supabaseAdmin
    .from("supplier_orders")
    .update({
      payment_approved_at: data.approved_at,
      payment_approved_by: input.approvedBy,
      updated_at: new Date().toISOString(),
    })
    .eq("organisation_id", input.context.organisationId)
    .eq("store_id", input.context.storeId)
    .eq("id", input.supplierOrderId);

  if (supplierOrderError) {
    throw new Error(
      `Failed to mark supplier order payment approval: ${supplierOrderError.message}`
    );
  }

  return mapSupplierPaymentApproval(data);
}

export async function createFulfilmentFailure(input: {
  context: TenantContext;
  orderId?: string;
  orderItemId?: string;
  supplierOrderId?: string;
  provider?: SupplierProvider;
  failureType: string;
  severity?: "info" | "review" | "blocked" | "critical";
  message: string;
  retryable?: boolean;
  payload?: Record<string, unknown>;
}): Promise<void> {
  const { error } = await supabaseAdmin.from("fulfilment_failures").insert({
    ...tenantColumns(input.context),
    order_id: input.orderId || null,
    order_item_id: input.orderItemId || null,
    supplier_order_id: input.supplierOrderId || null,
    provider: input.provider || null,
    failure_type: input.failureType,
    severity: input.severity || "review",
    message: input.message,
    retryable: input.retryable || false,
    payload: redactSensitiveData(input.payload || {}),
  });

  if (error) {
    throw new Error(`Failed to record fulfilment failure: ${error.message}`);
  }
}
