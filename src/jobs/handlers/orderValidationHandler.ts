import "server-only";

import type { TenantContext } from "@/context/storeContext";
import type { FulfilmentCheckResult } from "@/fulfilment/types";
import {
  createBlockedFulfilmentResult,
  getFinalFulfilmentDecision,
} from "@/fulfilment/evaluator";
import type { JobMessage } from "@/jobs/types";
import type { OrderValidationResult } from "@/orders/types";
import { getValidationStatusFromDecision } from "@/orders/mapping";
import type { CommerceOrderStatus } from "@/orders/status";
import { publishEvent } from "@/services/events/eventRepository";
import { validateOrderItemForFulfilment } from "@/services/fulfilment/validateOrderItemForFulfilment";
import { getCustomerById } from "@/services/repositories/customerRepository";
import {
  getOrderById,
  getOrderItems,
  saveOrderValidation,
  updateOrderStatus,
} from "@/services/repositories/orderRepository";
import { enqueueSupplierOrderCreationJob } from "@/services/jobs/enqueueSupplierOrderJob";
import { saveFulfilmentCheck } from "@/services/repositories/supplierFulfilmentRepository";
import { supabaseAdmin } from "@/services/supabase/admin";
import type { JobHandler } from "./types";

type ProductValidationRow = {
  id: string;
  stock: number | null;
  suggested_sell_price: number | string | null;
};

function tenantContextFromMessage(message: JobMessage): TenantContext {
  const payloadContext = message.payload.tenantContext as
    | Partial<TenantContext>
    | undefined;

  return {
    organisationId: message.organisationId,
    storeId: message.storeId,
    timezone: payloadContext?.timezone || "Europe/London",
    currency: payloadContext?.currency || "GBP",
    locale: payloadContext?.locale || "en-GB",
    userId: payloadContext?.userId,
    country: payloadContext?.country,
    organisationName: payloadContext?.organisationName,
    storeName: payloadContext?.storeName,
  };
}

function toNumber(value: unknown) {
  const parsed = Number(value);

  return Number.isFinite(parsed) ? parsed : 0;
}

function readString(
  data: Record<string, unknown> | undefined,
  keys: string[],
  fallback?: string
): string | undefined {
  if (!data) return fallback;

  for (const key of keys) {
    const value = data[key];

    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }

  return fallback;
}

async function buildDestination(input: {
  tenantContext: TenantContext;
  customerId?: string;
}) {
  const customer = input.customerId
    ? await getCustomerById(input.tenantContext, input.customerId)
    : null;
  const address = customer?.address || {};

  return {
    firstName: customer?.firstName || "Aiventra",
    lastName: customer?.lastName || "Customer",
    address1:
      readString(address, ["address1", "address_1", "line1"], "Unknown") ||
      "Unknown",
    address2: readString(address, ["address2", "address_2", "line2"], undefined),
    city: readString(address, ["city"], "Unknown") || "Unknown",
    province: readString(address, ["province", "state", "county"], undefined),
    postalCode:
      readString(address, ["zip", "postalCode", "postal_code"], "UNKNOWN") ||
      "UNKNOWN",
    countryCode: readString(
      address,
      ["country_code", "countryCode"],
      input.tenantContext.country || "GB"
    ) || "GB",
    phone: customer?.phone || readString(address, ["phone"], undefined),
    email: customer?.email,
  };
}

async function loadProductRows(
  tenantContext: TenantContext,
  productIds: string[]
) {
  if (productIds.length === 0) return new Map<string, ProductValidationRow>();

  const { data, error } = await supabaseAdmin
    .from("products")
    .select("id, stock, suggested_sell_price")
    .eq("organisation_id", tenantContext.organisationId)
    .eq("store_id", tenantContext.storeId)
    .in("id", productIds);

  if (error) {
    throw new Error(`Failed to load products for order validation: ${error.message}`);
  }

  return new Map(
    ((data || []) as ProductValidationRow[]).map((product) => [
      product.id,
      product,
    ])
  );
}

export const orderValidationHandler: JobHandler = {
  jobType: "ORDER_VALIDATION",

  async handle({ message, reportProgress }) {
    const tenantContext = tenantContextFromMessage(message);
    const orderId = String(message.payload.orderId || "");

    if (!orderId) {
      throw new Error("orderId is required for ORDER_VALIDATION jobs.");
    }

    await reportProgress(15, "Loading order");

    const order = await getOrderById(tenantContext, orderId);

    if (!order) {
      throw new Error("Order not found for validation.");
    }

    const items = await getOrderItems(tenantContext, orderId);

    await reportProgress(30, "Checking ordered products");

    const productIds = Array.from(
      new Set(items.flatMap((item) => (item.productId ? [item.productId] : [])))
    );
    const productsById = await loadProductRows(tenantContext, productIds);
    const destination = await buildDestination({
      tenantContext,
      customerId: order.customerId,
    });

    const productMapped =
      items.length > 0 && items.every((item) => Boolean(item.productId));
    const stockCached =
      productMapped &&
      items.every((item) => {
        const product = item.productId ? productsById.get(item.productId) : null;

        return product?.stock !== null && product?.stock !== undefined;
      });
    const costValid =
      items.length > 0 && items.every((item) => (item.cost || 0) > 0);
    const marginAcceptable =
      items.length > 0 &&
      items.every((item) => {
        if (!item.cost) return false;

        return ((item.price - item.cost) / item.price) * 100 >= 20;
      });
    const priceChanged = items.some((item) => {
      const product = item.productId ? productsById.get(item.productId) : null;
      const suggested = toNumber(product?.suggested_sell_price);

      return suggested > 0 && Math.abs(suggested - item.price) > 0.01;
    });
    const shippingCountrySupported = true;
    const fraudReviewRequired = false;

    await reportProgress(55, "Checking supplier fulfilment readiness");

    const itemResults: FulfilmentCheckResult[] = [];

    for (const item of items) {
      let result: FulfilmentCheckResult;

      try {
        result = await validateOrderItemForFulfilment({
          tenantContext,
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
      } catch (error) {
        result = createBlockedFulfilmentResult({
          orderItemId: item.id,
          blockers: [
            `Supplier fulfilment validation failed: ${
              error instanceof Error ? error.message : "Unknown error"
            }`,
          ],
          rawEvidence: {
            error: error instanceof Error ? error.message : "Unknown error",
          },
        });
      }

      await saveFulfilmentCheck({
        context: tenantContext,
        orderId: order.id,
        result,
      });

      itemResults.push(result);
    }

    const supplierMappingAvailable =
      itemResults.length > 0 &&
      itemResults.every((result) => Boolean(result.supplierMappingId));
    const fulfilmentDecision =
      itemResults.length > 0
        ? getFinalFulfilmentDecision(itemResults.map((result) => result.decision))
        : "BLOCKED";

    const blockers: string[] = [];
    const reasons: string[] = [];

    if (!items.length) blockers.push("Order contains no line items.");
    if (!productMapped) blockers.push("One or more order items are not mapped to Aiventra products.");
    if (priceChanged) blockers.push("Shopify sell price differs from Aiventra product price.");
    if (!shippingCountrySupported) blockers.push("Shipping country is not supported.");
    if (fraudReviewRequired) blockers.push("Fraud review is required.");

    if (productMapped) reasons.push("All order items are linked to Aiventra products.");
    if (supplierMappingAvailable) reasons.push("Supplier mapping is available.");
    if (stockCached) reasons.push("Stock evidence is cached.");
    if (costValid) reasons.push("Cost data is available.");
    if (marginAcceptable) reasons.push("Margin is acceptable.");
    if (fulfilmentDecision === "AUTO_FULFIL") {
      reasons.push("All supplier fulfilment checks passed.");
    }

    const basicDecision =
      !productMapped || !items.length
        ? "BLOCKED"
        : blockers.length > 0
          ? "MANUAL_REVIEW"
          : "AUTO_FULFIL";
    const decision = getFinalFulfilmentDecision([
      basicDecision,
      fulfilmentDecision,
    ]);
    const confidence =
      decision === "AUTO_FULFIL" ? 94 : decision === "MANUAL_REVIEW" ? 62 : 30;
    const result: OrderValidationResult = {
      decision,
      confidence,
      reasons,
      blockers,
      checks: {
        productMapped,
        supplierMappingAvailable,
        stockCached,
        costValid,
        marginAcceptable,
        priceChanged,
        shippingCountrySupported,
        fraudReviewRequired,
        fulfilmentDecision,
        fulfilmentChecks: itemResults,
      },
    };
    const validationStatus = getValidationStatusFromDecision(decision);
    const orderStatus: CommerceOrderStatus =
      validationStatus === "ready"
        ? "validated"
        : validationStatus === "blocked"
          ? "blocked"
          : "manual_review";

    await reportProgress(80, "Saving validation decision");

    await saveOrderValidation({
      tenantContext,
      orderId: order.id,
      jobId: message.jobId,
      result,
      validationStatus,
      orderStatus,
    });

    await publishEvent({
      tenantContext,
      eventType: "OrderValidated",
      aggregateType: "order",
      aggregateId: order.id,
      payload: {
        orderId: order.id,
        decision,
        confidence,
        validationStatus,
        blockers,
      },
      metadata: {
        correlationId: message.correlationId,
        causationId: message.jobId,
      },
    });

    if (decision === "AUTO_FULFIL") {
      await publishEvent({
        tenantContext,
        eventType: "AwaitingSupplier",
        aggregateType: "order",
        aggregateId: order.id,
        payload: {
          orderId: order.id,
          jobId: message.jobId,
          automaticSupplierOrderEnabled:
            process.env.AIVENTRA_CJ_ORDER_CREATION_ENABLED === "true",
        },
        metadata: {
          correlationId: message.correlationId,
          causationId: message.jobId,
        },
      });

      if (process.env.AIVENTRA_CJ_ORDER_CREATION_ENABLED === "true") {
        await enqueueSupplierOrderCreationJob({
          tenantContext,
          orderId: order.id,
          correlationId: message.correlationId,
          causationId: message.jobId,
        });
      } else {
        await updateOrderStatus({
          tenantContext,
          orderId: order.id,
          status: "awaiting_fulfilment",
        });
      }
    }

    return {
      resultReference: {
        orderId: order.id,
        decision,
        confidence,
        validationStatus,
        blockers,
      },
    };
  },
};
