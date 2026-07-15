import type {
  FulfilmentCheckResult,
  FulfilmentOrderItemInput,
  FulfilmentSupplierEvidence,
  FulfilmentSupplierMappingInput,
} from "./types";
import { FULFILMENT_THRESHOLDS } from "./config";

function round(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function getFinalFulfilmentDecision(
  decisions: FulfilmentCheckResult["decision"][]
): FulfilmentCheckResult["decision"] {
  if (decisions.includes("BLOCKED")) return "BLOCKED";
  if (decisions.includes("MANUAL_REVIEW")) return "MANUAL_REVIEW";

  return "AUTO_FULFIL";
}

export function createBlockedFulfilmentResult(input: {
  orderItemId: string;
  supplierAccountId?: string;
  supplierMappingId?: string;
  blockers: string[];
  warnings?: string[];
  reasons?: string[];
  rawEvidence?: Record<string, unknown>;
}): FulfilmentCheckResult {
  return {
    orderItemId: input.orderItemId,
    decision: "BLOCKED",
    supplierAccountId: input.supplierAccountId,
    supplierMappingId: input.supplierMappingId,
    blockers: input.blockers,
    warnings: input.warnings || [],
    reasons: input.reasons || [],
    rawEvidence: input.rawEvidence || {},
  };
}

export function evaluateFulfilmentCheck(input: {
  orderItem: FulfilmentOrderItemInput;
  mapping?: FulfilmentSupplierMappingInput;
  evidence?: FulfilmentSupplierEvidence;
}): FulfilmentCheckResult {
  const blockers: string[] = [];
  const warnings: string[] = [];
  const reasons: string[] = [];

  if (!input.orderItem.productId) {
    return createBlockedFulfilmentResult({
      orderItemId: input.orderItem.id,
      blockers: [
        "The Shopify order item is not mapped to an Aiventra product.",
      ],
    });
  }

  if (!input.mapping) {
    return createBlockedFulfilmentResult({
      orderItemId: input.orderItem.id,
      blockers: ["No active supplier mapping exists for this product."],
    });
  }

  if (!input.evidence) {
    return createBlockedFulfilmentResult({
      orderItemId: input.orderItem.id,
      supplierAccountId: input.mapping.supplierAccountId,
      supplierMappingId: input.mapping.id,
      blockers: ["Supplier fulfilment evidence is missing."],
    });
  }

  const { inventory, pricing, shipping } = input.evidence;

  if (!input.mapping.preferred) {
    warnings.push(
      "The selected supplier mapping is not marked as preferred."
    );
  }

  if (!inventory.available) {
    blockers.push("The supplier does not have sufficient stock.");
  } else {
    reasons.push("Supplier inventory is sufficient.");
  }

  const shippingOption = shipping.options
    .filter((option) => {
      const maximumDays =
        option.deliveryDaysMax ??
        option.deliveryDaysMin ??
        Number.MAX_SAFE_INTEGER;

      return (
        option.cost <= FULFILMENT_THRESHOLDS.maximumShippingCost &&
        maximumDays <= FULFILMENT_THRESHOLDS.maximumDeliveryDays
      );
    })
    .sort((a, b) => a.cost - b.cost)[0];

  if (!shippingOption) {
    blockers.push(
      "No shipping option meets the configured cost and delivery limits."
    );
  } else {
    reasons.push(
      `Shipping option ${shippingOption.name} meets the configured limits.`
    );
  }

  const originalUnitCost = input.orderItem.originalUnitCost;
  const costChangePercent =
    originalUnitCost && originalUnitCost > 0
      ? ((pricing.unitCost - originalUnitCost) / originalUnitCost) * 100
      : undefined;

  if (
    costChangePercent !== undefined &&
    costChangePercent >
      FULFILMENT_THRESHOLDS.maximumSupplierCostIncreasePercent
  ) {
    warnings.push(
      `Supplier cost increased by ${costChangePercent.toFixed(1)}%.`
    );
  }

  const revenue = input.orderItem.unitPrice * input.orderItem.quantity;
  const supplierCost = pricing.unitCost * input.orderItem.quantity;
  const shippingCost = shippingOption?.cost ?? 0;
  const estimatedNetProfit = revenue - supplierCost - shippingCost;
  const estimatedNetMarginPercent =
    revenue > 0 ? (estimatedNetProfit / revenue) * 100 : 0;

  if (estimatedNetProfit < FULFILMENT_THRESHOLDS.minimumNetProfit) {
    blockers.push(
      "Updated fulfilment costs leave insufficient net profit."
    );
  }

  if (
    estimatedNetMarginPercent <
    FULFILMENT_THRESHOLDS.minimumNetMarginPercent
  ) {
    blockers.push(
      "Updated net margin is below the fulfilment threshold."
    );
  }

  if (revenue > FULFILMENT_THRESHOLDS.maximumAutoFulfilOrderValue) {
    warnings.push(
      "Order item value exceeds the automatic fulfilment limit."
    );
  }

  const decision =
    blockers.length > 0
      ? "BLOCKED"
      : warnings.length > 0 || !input.mapping.preferred
        ? "MANUAL_REVIEW"
        : "AUTO_FULFIL";

  return {
    orderItemId: input.orderItem.id,
    decision,
    supplierAccountId: input.mapping.supplierAccountId,
    supplierMappingId: input.mapping.id,
    inventoryAvailable: inventory.available,
    availableQuantity: inventory.availableQuantity,
    latestUnitCost: pricing.unitCost,
    originalUnitCost,
    costChangePercent:
      costChangePercent === undefined ? undefined : round(costChangePercent),
    shippingCost: shippingOption?.cost,
    deliveryDaysMin: shippingOption?.deliveryDaysMin,
    deliveryDaysMax: shippingOption?.deliveryDaysMax,
    shippingMethod: shippingOption?.name,
    estimatedNetProfit: round(estimatedNetProfit),
    estimatedNetMarginPercent: round(estimatedNetMarginPercent),
    blockers,
    warnings,
    reasons,
    rawEvidence: {
      inventory,
      pricing,
      shipping,
    },
  };
}
