import "server-only";

import type { TenantContext } from "@/context/storeContext";
import type { CommerceOrder } from "@/orders/types";
import { getSupplierConnector } from "@/suppliers/SupplierRegistry";
import { registerSupplierConnectors } from "@/suppliers/registerSupplierConnectors";
import type { SupplierAddress, SupplierProvider } from "@/suppliers/types";
import { publishEvent } from "@/services/events/eventRepository";
import { assertOrderWorkAllowed } from "@/services/recovery/assertOrderWorkAllowed";
import { validateOrderItemForFulfilment } from "@/services/fulfilment/validateOrderItemForFulfilment";
import { getCustomerById } from "@/services/repositories/customerRepository";
import {
  getOrderById,
  getOrderItems,
  updateOrderStatus,
} from "@/services/repositories/orderRepository";
import {
  getFulfilmentChecksForOrder,
  getSupplierMappingById,
  saveFulfilmentCheck,
  type SupplierMappingWithAccountRecord,
} from "@/services/repositories/supplierFulfilmentRepository";
import type { FulfilmentCheckResult } from "@/fulfilment/types";
import {
  appendSupplierOrderEvent,
  claimSupplierOrderForSubmission,
  createFulfilmentFailure,
  createPendingSupplierOrder,
  getSupplierOrderByOrderId,
  markSupplierOrderAwaitingPayment,
  markSupplierOrderCreated,
  markSupplierOrderFailed,
  markSupplierOrderReviewRequired,
  upsertSupplierPaymentApproval,
  type SupplierOrderRecord,
} from "@/services/repositories/supplierOrderRepository";

const APPROVAL_LIMITS = {
  maximumOrderTotal: 100,
  maximumSupplierPriceIncreasePercent: 5,
  maximumShippingIncrease: 2,
  minimumNetMarginPercent: 20,
} as const;

export type SupplierOrderCreationOutcome =
  | {
      status: "created" | "awaiting_payment" | "already_exists";
      supplierOrder: SupplierOrderRecord;
    }
  | {
      status: "review_required" | "blocked";
      reason: string;
      blockers: string[];
      supplierOrder?: SupplierOrderRecord;
    };

function readString(
  data: Record<string, unknown> | undefined,
  keys: string[]
): string | undefined {
  if (!data) return undefined;

  for (const key of keys) {
    const value = data[key];

    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }

  return undefined;
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Unknown supplier order error.";
}

async function buildDestination(input: {
  context: TenantContext;
  order: CommerceOrder;
}): Promise<{ destination?: SupplierAddress; blockers: string[] }> {
  if (!input.order.customerId) {
    return {
      blockers: ["Order has no customer record."],
    };
  }

  const customer = await getCustomerById(input.context, input.order.customerId);

  if (!customer) {
    return {
      blockers: ["Order customer could not be loaded."],
    };
  }

  const address = customer.address || {};
  const destination: SupplierAddress = {
    firstName: customer.firstName || readString(address, ["firstName", "first_name"]) || "",
    lastName: customer.lastName || readString(address, ["lastName", "last_name"]) || "",
    address1: readString(address, ["address1", "address_1", "line1"]) || "",
    address2: readString(address, ["address2", "address_2", "line2"]),
    city: readString(address, ["city"]) || "",
    province: readString(address, ["province", "state", "county"]),
    postalCode: readString(address, ["zip", "postalCode", "postal_code"]) || "",
    countryCode:
      readString(address, ["country_code", "countryCode"]) ||
      input.context.country ||
      "GB",
    phone: customer.phone || readString(address, ["phone"]),
    email: customer.email,
  };
  const blockers = [];

  if (!destination.firstName || !destination.lastName) {
    blockers.push("Customer name is incomplete.");
  }
  if (!destination.address1 || !destination.city || !destination.postalCode) {
    blockers.push("Shipping address is incomplete.");
  }
  if (!destination.countryCode) {
    blockers.push("Shipping country is missing.");
  }

  return blockers.length ? { blockers } : { destination, blockers };
}

function isPaid(order: CommerceOrder) {
  return ["paid", "partially_paid"].includes(
    String(order.financialStatus || "").toLowerCase()
  );
}

function getOrderReference(order: CommerceOrder) {
  return order.shopifyOrderName || order.orderNumber || order.shopifyOrderId;
}

async function moveOrderToReview(input: {
  context: TenantContext;
  orderId: string;
  reason: string;
  blockers: string[];
  supplierOrderId?: string;
  provider?: SupplierProvider;
  retryable?: boolean;
}) {
  await updateOrderStatus({
    tenantContext: input.context,
    orderId: input.orderId,
    status: input.reason === "Approval required"
      ? "awaiting_fulfilment_approval"
      : "manual_review",
  });

  await createFulfilmentFailure({
    context: input.context,
    orderId: input.orderId,
    supplierOrderId: input.supplierOrderId,
    provider: input.provider,
    failureType: input.reason,
    severity: input.reason === "Approval required" ? "review" : "blocked",
    message: input.blockers.join(" "),
    retryable: input.retryable,
    payload: {
      blockers: input.blockers,
    },
  });
}

export async function createSupplierOrder(input: {
  context: TenantContext;
  orderId: string;
  jobId?: string;
  approved?: boolean;
  onProgress?: (progress: number, step: string) => Promise<void>;
}): Promise<SupplierOrderCreationOutcome> {
  registerSupplierConnectors();

  await input.onProgress?.(10, "Loading order");

  const order = await getOrderById(input.context, input.orderId);

  if (!order) {
    throw new Error("Order not found.");
  }

  const existingSupplierOrder = await getSupplierOrderByOrderId(
    input.context,
    order.id
  );

  await input.onProgress?.(20, "Checking idempotency");

  if (existingSupplierOrder) {
    return {
      status: "already_exists",
      supplierOrder: existingSupplierOrder,
    };
  }

  const blockers: string[] = [];

  if (!isPaid(order)) blockers.push("Order is not paid.");
  if (order.status === "cancelled" || order.cancelledAt) {
    blockers.push("Order has been cancelled.");
  }
  if (order.status === "refunded" || order.refundedAt) {
    blockers.push("Order has been refunded.");
  }

  const destinationResult = await buildDestination({
    context: input.context,
    order,
  });

  blockers.push(...destinationResult.blockers);

  const items = await getOrderItems(input.context, order.id);

  if (!items.length) blockers.push("Order has no line items.");

  const savedChecks = await getFulfilmentChecksForOrder(input.context, order.id);
  const savedChecksByItemId = new Map(
    savedChecks.map((check) => [check.orderItemId, check])
  );

  for (const item of items) {
    const check = savedChecksByItemId.get(item.id);

    if (!item.productId) {
      blockers.push(`Order item "${item.title}" is not mapped to a product.`);
    }
    if (!check) {
      blockers.push(`Order item "${item.title}" has no fulfilment check.`);
    } else if (check.decision !== "AUTO_FULFIL") {
      blockers.push(`Order item "${item.title}" is not approved for fulfilment.`);
    }
    if (!check?.supplierMappingId || !check.supplierAccountId) {
      blockers.push(`Order item "${item.title}" has no supplier mapping.`);
    }
  }

  if (blockers.length || !destinationResult.destination) {
    await moveOrderToReview({
      context: input.context,
      orderId: order.id,
      reason: "Supplier order blocked",
      blockers,
    });

    return {
      status: "blocked",
      reason: "Supplier order blocked",
      blockers,
    };
  }

  const destination = destinationResult.destination;

  await input.onProgress?.(35, "Revalidating stock");
  await input.onProgress?.(50, "Revalidating price");
  await input.onProgress?.(65, "Revalidating shipping");

  const revalidatedChecks: FulfilmentCheckResult[] = [];

  for (const item of items) {
    const result = await validateOrderItemForFulfilment({
      tenantContext: input.context,
      orderItem: {
        id: item.id,
        quantity: item.quantity,
        unitPrice: item.price,
        productId: item.productId,
        originalUnitCost: item.cost,
      },
      destination,
      currency: order.currency,
    });

    await saveFulfilmentCheck({
      context: input.context,
      orderId: order.id,
      result,
    });

    revalidatedChecks.push(result);

    if (result.decision !== "AUTO_FULFIL") {
      blockers.push(`Order item "${item.title}" failed current supplier checks.`);
    }
    if (result.inventoryAvailable === false) {
      blockers.push(`Order item "${item.title}" has insufficient stock.`);
    }
  }

  if (blockers.length) {
    await moveOrderToReview({
      context: input.context,
      orderId: order.id,
      reason: "Supplier revalidation blocked",
      blockers,
    });

    return {
      status: "blocked",
      reason: "Supplier revalidation blocked",
      blockers,
    };
  }

  const approvalReasons: string[] = [];

  if (order.total > APPROVAL_LIMITS.maximumOrderTotal) {
    approvalReasons.push("Order total exceeds automatic fulfilment approval limit.");
  }

  const supplierAccountIds = new Set(
    revalidatedChecks
      .map((check) => check.supplierAccountId)
      .filter(Boolean)
  );

  if (supplierAccountIds.size > 1) {
    approvalReasons.push("Multiple suppliers are required for this order.");
  }

  for (const check of revalidatedChecks) {
    const previous = savedChecksByItemId.get(check.orderItemId);

    if (
      check.costChangePercent !== undefined &&
      check.costChangePercent >
        APPROVAL_LIMITS.maximumSupplierPriceIncreasePercent
    ) {
      approvalReasons.push("Supplier price increased beyond approval tolerance.");
    }
    if (
      previous?.shippingCost !== undefined &&
      check.shippingCost !== undefined &&
      check.shippingCost - previous.shippingCost >
        APPROVAL_LIMITS.maximumShippingIncrease
    ) {
      approvalReasons.push("Shipping cost increased beyond approval tolerance.");
    }
    if (
      check.estimatedNetMarginPercent !== undefined &&
      check.estimatedNetMarginPercent <
        APPROVAL_LIMITS.minimumNetMarginPercent
    ) {
      approvalReasons.push("Net margin is below automatic fulfilment threshold.");
    }
  }

  if (approvalReasons.length && !input.approved) {
    await moveOrderToReview({
      context: input.context,
      orderId: order.id,
      reason: "Approval required",
      blockers: Array.from(new Set(approvalReasons)),
    });

    return {
      status: "review_required",
      reason: "Approval required",
      blockers: Array.from(new Set(approvalReasons)),
    };
  }

  const supplierAccountId = revalidatedChecks[0]?.supplierAccountId;
  const supplierMappingIds = revalidatedChecks.map(
    (check) => check.supplierMappingId
  );

  if (!supplierAccountId || supplierMappingIds.some((id) => !id)) {
    throw new Error("Supplier mapping is missing after revalidation.");
  }

  const mappings = await Promise.all(
    supplierMappingIds.map((mappingId) =>
      getSupplierMappingById(input.context, String(mappingId))
    )
  );

  if (mappings.some((mapping) => !mapping)) {
    throw new Error("Supplier mapping could not be loaded after revalidation.");
  }

  const typedMappings = mappings.filter(
    (mapping): mapping is SupplierMappingWithAccountRecord => Boolean(mapping)
  );
  const providers = new Set(typedMappings.map((mapping) => mapping.provider));

  if (providers.size !== 1 || !typedMappings[0]) {
    throw new Error("Supplier order creation currently supports one provider.");
  }

  const primaryMapping = typedMappings[0];
  const provider = primaryMapping.provider;
  const connector = getSupplierConnector(provider);
  const idempotencyKey = `${input.context.organisationId}:${input.context.storeId}:${order.id}:${supplierAccountId}`;
  const itemsById = new Map(items.map((item) => [item.id, item]));
  const supplierOrderItems = typedMappings.map((mapping) => {
    const check = revalidatedChecks.find(
      (itemCheck) => itemCheck.supplierMappingId === mapping.id
    );
    const item = check ? itemsById.get(check.orderItemId) : undefined;

    if (!item || !check) {
      throw new Error("Could not match supplier mapping to order item.");
    }

    return {
      orderItemId: item.id,
      productId: item.productId,
      supplierProductMappingId: mapping.id,
      supplierProductId: mapping.supplierProductId,
      supplierVariantId: mapping.supplierVariantId,
      supplierSku: mapping.supplierSku,
      warehouseId: mapping.warehouseId,
      title: item.title,
      quantity: item.quantity,
      unitCost: check.latestUnitCost || item.cost || 0,
      shippingCost: check.shippingCost || 0,
      requestPayload: {
        orderItemId: item.id,
        supplierProductId: mapping.supplierProductId,
        supplierVariantId: mapping.supplierVariantId,
      },
    };
  });

  const supplierOrder = await createPendingSupplierOrder({
    context: input.context,
    orderId: order.id,
    supplierAccountId,
    provider,
    clientOrderReference: getOrderReference(order),
    currency: order.currency,
    idempotencyKey,
    items: supplierOrderItems,
    shippingMethod: revalidatedChecks[0]?.shippingMethod,
    requestPayload: {
      orderId: order.id,
      itemCount: supplierOrderItems.length,
      provider,
    },
  });

  await appendSupplierOrderEvent({
    context: input.context,
    supplierOrderId: supplierOrder.id,
    eventType: "PENDING_CREATED",
    message: "Internal supplier order created.",
    payload: {
      orderId: order.id,
      provider,
      jobId: input.jobId,
    },
  });

  const claimed = await claimSupplierOrderForSubmission(
    input.context,
    supplierOrder.id
  );

  if (!claimed) {
    const currentOrder = await getSupplierOrderByOrderId(input.context, order.id);

    if (currentOrder) {
      return {
        status: "already_exists",
        supplierOrder: currentOrder,
      };
    }

    throw new Error("Supplier order could not be claimed for submission.");
  }

  await input.onProgress?.(80, "Creating CJ order");

  try {
    await assertOrderWorkAllowed(order.id);

    const supplierResult = await connector.createOrder({
      orderId: order.id,
      clientOrderReference: getOrderReference(order),
      currency: order.currency,
      destination,
      shippingMethodId: primaryMapping.shippingMethodId,
      metadata: {
        jobId: input.jobId,
        supplierOrderId: supplierOrder.id,
      },
      items: supplierOrderItems.map((item) => ({
        orderItemId: item.orderItemId,
        product: {
          supplierProductId: item.supplierProductId,
          supplierVariantId: item.supplierVariantId,
          supplierSku: item.supplierSku,
          warehouseId: item.warehouseId,
        },
        title: item.title,
        quantity: item.quantity,
        unitPrice: item.unitCost,
        currency: order.currency,
        shippingMethodId: primaryMapping.shippingMethodId,
      })),
    });

    if (!supplierResult.success || !supplierResult.externalOrderId) {
      await markSupplierOrderReviewRequired({
        context: input.context,
        supplierOrderId: supplierOrder.id,
        reason: supplierResult.errorMessage || "Supplier did not create order.",
        responsePayload: supplierResult.raw,
      });

      await moveOrderToReview({
        context: input.context,
        orderId: order.id,
        supplierOrderId: supplierOrder.id,
        provider,
        reason: "Supplier creation review required",
        blockers: [
          supplierResult.errorMessage || "Supplier did not create order.",
        ],
      });

      return {
        status: "review_required",
        reason: "Supplier creation review required",
        blockers: [
          supplierResult.errorMessage || "Supplier did not create order.",
        ],
        supplierOrder,
      };
    }

    await input.onProgress?.(95, "Saving supplier order");

    const createdOrder = await markSupplierOrderCreated({
      context: input.context,
      supplierOrderId: supplierOrder.id,
      externalOrderId: supplierResult.externalOrderId,
      productCost: supplierResult.productCost,
      shippingCost: supplierResult.shippingCost,
      totalCost: supplierResult.totalCost,
      responsePayload: supplierResult.raw,
    });

    const awaitingPayment = await markSupplierOrderAwaitingPayment({
      context: input.context,
      supplierOrderId: createdOrder.id,
      responsePayload: supplierResult.raw,
    });

    await upsertSupplierPaymentApproval({
      context: input.context,
      supplierOrderId: awaitingPayment.id,
      requestedAmount: awaitingPayment.totalCost,
      currency: awaitingPayment.currency,
      reason: "Manual CJ payment approval is required.",
    });

    await updateOrderStatus({
      tenantContext: input.context,
      orderId: order.id,
      status: "awaiting_fulfilment",
    });

    await appendSupplierOrderEvent({
      context: input.context,
      supplierOrderId: supplierOrder.id,
      eventType: "AWAITING_PAYMENT",
      message: "Supplier order created and awaiting manual payment approval.",
      payload: {
        externalOrderId: supplierResult.externalOrderId,
        apiUsage: supplierResult.apiUsage,
      },
    });

    await publishEvent({
      tenantContext: input.context,
      eventType: "SupplierOrderCreated",
      aggregateType: "order",
      aggregateId: order.id,
      payload: {
        orderId: order.id,
        supplierOrderId: awaitingPayment.id,
        externalOrderId: supplierResult.externalOrderId,
        status: awaitingPayment.status,
      },
    });

    await input.onProgress?.(100, "Awaiting payment");

    return {
      status: "awaiting_payment",
      supplierOrder: awaitingPayment,
    };
  } catch (error) {
    const message = getErrorMessage(error);

    await markSupplierOrderFailed({
      context: input.context,
      supplierOrderId: supplierOrder.id,
      errorMessage: message,
    });

    await createFulfilmentFailure({
      context: input.context,
      orderId: order.id,
      supplierOrderId: supplierOrder.id,
      provider,
      failureType: "Supplier submission failed",
      severity: "blocked",
      message,
      retryable: true,
    });

    throw error;
  }
}
