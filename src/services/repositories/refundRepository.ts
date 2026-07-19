import "server-only";

import type { RefundInput } from "@/recovery/types";
import { calculateOrderRefundStatus } from "@/recovery/calculateRefundStatus";
import { redactSensitiveData } from "@/security/redactSensitiveData";
import { supabaseAdmin } from "@/services/supabase/admin";

type OrderItemRow = {
  id: string;
  shopify_line_item_id: string | null;
  quantity: number;
};

type RefundRow = {
  total_amount: number | string | null;
  refund_items:
    | Array<{
        quantity?: number | string | null;
      }>
    | null;
};

export async function persistRefund(
  input: RefundInput
): Promise<{
  refundId: string;
  duplicate: boolean;
}> {
  const { data: existing, error: existingError } = await supabaseAdmin
    .from("refunds")
    .select("id")
    .eq("store_id", input.storeId)
    .eq("platform", input.platform)
    .eq("external_refund_id", input.externalRefundId)
    .maybeSingle<{ id: string }>();

  if (existingError) {
    throw new Error(
      `Failed to check refund idempotency: ${existingError.message}`
    );
  }

  if (existing) {
    return {
      refundId: existing.id,
      duplicate: true,
    };
  }

  const { data: refund, error: refundError } = await supabaseAdmin
    .from("refunds")
    .insert({
      organisation_id: input.organisationId,
      store_id: input.storeId,
      order_id: input.orderId,
      platform: input.platform,
      external_refund_id: input.externalRefundId,
      status: "processed",
      currency: input.currency,
      subtotal_amount: input.subtotalAmount,
      tax_amount: input.taxAmount,
      shipping_amount: input.shippingAmount,
      total_amount: input.totalAmount,
      reason: input.reason ?? null,
      note: input.note ?? null,
      processed_at: input.processedAt ?? new Date().toISOString(),
      payload: redactSensitiveData(input.payload ?? {}),
      updated_at: new Date().toISOString(),
    })
    .select("id")
    .single<{ id: string }>();

  if (refundError || !refund) {
    throw new Error(
      `Failed to persist refund: ${
        refundError?.message ?? "No refund row returned."
      }`
    );
  }

  const { data: orderItems, error: orderItemsError } = await supabaseAdmin
    .from("order_items")
    .select("id, shopify_line_item_id, quantity")
    .eq("order_id", input.orderId);

  if (orderItemsError) {
    throw new Error(`Failed to load order items: ${orderItemsError.message}`);
  }

  const itemByExternalId = new Map(
    ((orderItems ?? []) as OrderItemRow[]).map((item) => [
      String(item.shopify_line_item_id ?? ""),
      item,
    ])
  );

  const refundItemRows = input.items.map((item) => {
    const matchedOrderItem = itemByExternalId.get(item.externalLineItemId);

    return {
      refund_id: refund.id,
      order_item_id: matchedOrderItem?.id ?? null,
      external_line_item_id: item.externalLineItemId,
      quantity: item.quantity,
      subtotal_amount: item.subtotalAmount,
      tax_amount: item.taxAmount,
      total_amount: item.totalAmount,
      restock_type: item.restockType ?? null,
      reason: item.reason ?? null,
    };
  });

  if (refundItemRows.length > 0) {
    const { error } = await supabaseAdmin.from("refund_items").upsert(
      refundItemRows,
      {
        onConflict: "refund_id,external_line_item_id",
      }
    );

    if (error) {
      throw new Error(`Failed to persist refund items: ${error.message}`);
    }
  }

  await recalculateOrderRefundStatus(input.orderId);

  return {
    refundId: refund.id,
    duplicate: false,
  };
}

export async function recalculateOrderRefundStatus(orderId: string) {
  const { data: order, error: orderError } = await supabaseAdmin
    .from("orders")
    .select("id, total")
    .eq("id", orderId)
    .single<{
      id: string;
      total: number | string;
    }>();

  if (orderError || !order) {
    throw new Error(
      `Failed to load order: ${orderError?.message ?? "Order was not found."}`
    );
  }

  const { data: orderItems, error: orderItemsError } = await supabaseAdmin
    .from("order_items")
    .select("quantity")
    .eq("order_id", orderId);

  if (orderItemsError) {
    throw new Error(
      `Failed to load order quantities: ${orderItemsError.message}`
    );
  }

  const { data: refunds, error: refundsError } = await supabaseAdmin
    .from("refunds")
    .select(
      `
        total_amount,
        refund_items (
          quantity
        )
      `
    )
    .eq("order_id", orderId)
    .eq("status", "processed");

  if (refundsError) {
    throw new Error(`Failed to load order refunds: ${refundsError.message}`);
  }

  const refundedTotal = ((refunds ?? []) as RefundRow[]).reduce(
    (total, refund) => total + Number(refund.total_amount ?? 0),
    0
  );

  const refundedItemQuantity = ((refunds ?? []) as RefundRow[]).reduce(
    (refundTotal, refund) => {
      const items = Array.isArray(refund.refund_items) ? refund.refund_items : [];

      return (
        refundTotal +
        items.reduce(
          (itemTotal, item) => itemTotal + Number(item.quantity ?? 0),
          0
        )
      );
    },
    0
  );

  const totalItemQuantity = (orderItems ?? []).reduce(
    (total, item) => total + Number(item.quantity ?? 0),
    0
  );

  const summary = calculateOrderRefundStatus({
    orderTotal: Number(order.total ?? 0),
    refundedTotal,
    totalItemQuantity,
    refundedItemQuantity,
  });

  if (summary.status !== "not_refunded") {
    const { error } = await supabaseAdmin
      .from("orders")
      .update({
        status: summary.status,
        refunded_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", orderId);

    if (error) {
      throw new Error(
        `Failed to update order refund status: ${error.message}`
      );
    }
  }

  return summary;
}

export async function orderHasAnyRefund(orderId: string): Promise<boolean> {
  const { count, error } = await supabaseAdmin
    .from("refunds")
    .select("id", {
      count: "exact",
      head: true,
    })
    .eq("order_id", orderId)
    .eq("status", "processed");

  if (error) {
    throw new Error(`Failed to check order refunds: ${error.message}`);
  }

  return Number(count ?? 0) > 0;
}
