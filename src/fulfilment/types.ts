import type {
  SupplierInventoryResult,
  SupplierPriceResult,
  SupplierShippingQuoteResult,
} from "@/suppliers/types";

export type FulfilmentDecision =
  | "AUTO_FULFIL"
  | "MANUAL_REVIEW"
  | "BLOCKED";

export type FulfilmentCheckResult = {
  orderItemId: string;

  decision: FulfilmentDecision;

  supplierAccountId?: string;
  supplierMappingId?: string;

  inventoryAvailable?: boolean;
  availableQuantity?: number;

  latestUnitCost?: number;
  originalUnitCost?: number;
  costChangePercent?: number;

  shippingCost?: number;
  deliveryDaysMin?: number;
  deliveryDaysMax?: number;
  shippingMethod?: string;

  estimatedNetProfit?: number;
  estimatedNetMarginPercent?: number;

  blockers: string[];
  warnings: string[];
  reasons: string[];

  rawEvidence: Record<string, unknown>;
};

export type FulfilmentOrderItemInput = {
  id: string;
  quantity: number;
  unitPrice: number;
  productId?: string;
  originalUnitCost?: number;
};

export type FulfilmentSupplierMappingInput = {
  id: string;
  supplierAccountId: string;
  preferred: boolean;
};

export type FulfilmentSupplierEvidence = {
  inventory: SupplierInventoryResult;
  pricing: SupplierPriceResult;
  shipping: SupplierShippingQuoteResult;
};
