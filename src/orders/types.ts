import type {
  FulfilmentCheckResult,
  FulfilmentDecision,
} from "@/fulfilment/types";
import type {
  CommerceOrderStatus,
  OrderItemFulfilmentStatus,
  OrderValidationDecision,
  OrderValidationStatus,
} from "./status";

export type CommerceCustomer = {
  id: string;
  shopifyCustomerId?: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  address: Record<string, unknown>;
};

export type CommerceOrderItem = {
  id: string;
  orderId: string;
  productId?: string;
  shopifyLineItemId: string;
  shopifyProductId?: string;
  shopifyVariantId?: string;
  title: string;
  sku?: string;
  quantity: number;
  price: number;
  cost?: number;
  profit?: number;
  supplierId?: string;
  supplierProductId?: string;
  fulfilmentStatus: OrderItemFulfilmentStatus;
};

export type CommerceOrder = {
  id: string;
  organisationId: string;
  storeId: string;
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
  customerId?: string;
  validationStatus: OrderValidationStatus;
  validationDecision?: OrderValidationResult;
  placedAt?: string;
  cancelledAt?: string;
  refundedAt?: string;
  createdAt: string;
  updatedAt: string;
};

export type OrderValidationResult = {
  decision: OrderValidationDecision;
  confidence: number;
  reasons: string[];
  blockers: string[];
  checks: {
    productMapped: boolean;
    supplierMappingAvailable: boolean;
    stockCached: boolean;
    costValid: boolean;
    marginAcceptable: boolean;
    priceChanged: boolean;
    shippingCountrySupported: boolean;
    fraudReviewRequired: boolean;
    fulfilmentDecision?: FulfilmentDecision;
    fulfilmentChecks?: FulfilmentCheckResult[];
  };
};

export type OrderWorkspace = {
  order: CommerceOrder;
  customer?: CommerceCustomer;
  items: CommerceOrderItem[];
  validations: OrderValidationResult[];
  events: Array<{
    id: string;
    eventType: string;
    createdAt: string;
    payload: Record<string, unknown>;
  }>;
};
