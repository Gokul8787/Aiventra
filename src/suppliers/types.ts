export type SupplierProvider = "cj" | "aliexpress" | "autods" | "syncee";

export type SupplierCapability =
  | "inventory"
  | "pricing"
  | "shipping_quote"
  | "order_creation"
  | "order_status"
  | "tracking"
  | "cancellation";

export type SupplierAddress = {
  firstName: string;
  lastName: string;
  company?: string;

  address1: string;
  address2?: string;

  city: string;
  province?: string;
  postalCode: string;
  countryCode: string;

  phone?: string;
  email?: string;
};

export type SupplierProductReference = {
  supplierProductId: string;
  supplierVariantId?: string;
  supplierSku?: string;
  warehouseId?: string;
};

export type SupplierInventoryInput = {
  product: SupplierProductReference;
  quantity: number;
};

export type SupplierInventoryResult = {
  available: boolean;
  availableQuantity?: number;
  warehouseId?: string;

  checkedAt: string;
  raw?: Record<string, unknown>;
};

export type SupplierPriceInput = {
  product: SupplierProductReference;
  quantity: number;
  currency: string;
};

export type SupplierPriceResult = {
  unitCost: number;
  currency: string;

  minimumQuantity?: number;

  checkedAt: string;
  raw?: Record<string, unknown>;
};

export type SupplierShippingQuoteInput = {
  product: SupplierProductReference;
  quantity: number;
  destination: SupplierAddress;
  currency: string;
};

export type SupplierShippingOption = {
  id: string;
  name: string;

  cost: number;
  currency: string;

  deliveryDaysMin?: number;
  deliveryDaysMax?: number;

  trackingAvailable: boolean;

  raw?: Record<string, unknown>;
};

export type SupplierShippingQuoteResult = {
  options: SupplierShippingOption[];
  checkedAt: string;
};

export type SupplierOrderCreationItem = {
  orderItemId: string;
  product: SupplierProductReference;
  title: string;
  quantity: number;
  unitPrice: number;
  currency: string;
  shippingMethodId?: string;
};

export type SupplierOrderCreationInput = {
  orderId: string;
  clientOrderReference: string;
  currency: string;
  destination: SupplierAddress;
  items: SupplierOrderCreationItem[];
  shippingMethodId?: string;
  metadata?: Record<string, unknown>;
};

export type SupplierOrderStatus =
  | "PENDING"
  | "CREATED"
  | "AWAITING_PAYMENT"
  | "PAID"
  | "PROCESSING"
  | "SHIPPED"
  | "DELIVERED"
  | "CANCELLED"
  | "FAILED"
  | "UNKNOWN";

export type SupplierTrackingStatus =
  | "PENDING"
  | "INFO_RECEIVED"
  | "IN_TRANSIT"
  | "OUT_FOR_DELIVERY"
  | "DELIVERED"
  | "EXCEPTION"
  | "RETURNED"
  | "CANCELLED"
  | "UNKNOWN";

export type SupplierTrackingEvent = {
  externalEventId?: string;
  status: SupplierTrackingStatus;
  description: string;
  location?: string;
  eventAt: string;
  rawStatus?: string;
  raw?: Record<string, unknown>;
};

export type SupplierApiUsage = {
  usedToday?: number;
  remaining?: number;
  total?: number;
  raw?: Record<string, unknown>;
};

export type SupplierOrderCreationResult = {
  success: boolean;
  externalOrderId?: string;
  status: SupplierOrderStatus;
  paymentRequired: boolean;
  productCost: number;
  shippingCost: number;
  totalCost: number;
  requestId?: string;
  raw?: Record<string, unknown>;
  apiUsage?: SupplierApiUsage;
  errorMessage?: string;
};

export type SupplierPaymentStatus =
  | "NOT_REQUIRED"
  | "UNPAID"
  | "PAYMENT_PENDING"
  | "PAID"
  | "PAYMENT_FAILED"
  | "UNKNOWN";

export type SupplierOrderStatusResult = {
  success: boolean;
  externalOrderId: string;
  status: SupplierOrderStatus;
  paymentStatus: SupplierPaymentStatus;
  remoteStatus?: string;
  remotePaymentStatus?: string;
  parentOrderId?: string;
  paymentId?: string;
  trackingNumber?: string;
  trackingUrl?: string;
  requestId?: string;
  raw?: Record<string, unknown>;
  apiUsage?: SupplierApiUsage;
  checkedAt: string;
  retryable?: boolean;
  message?: string;
};

export type SupplierTrackingResult = {
  success: boolean;
  externalOrderId: string;
  trackingNumber?: string;
  trackingUrl?: string;
  carrierCode?: string;
  carrierName?: string;
  status: SupplierTrackingStatus;
  events: SupplierTrackingEvent[];
  shippedAt?: string;
  deliveredAt?: string;
  requestId?: string;
  checkedAt: string;
  retryable?: boolean;
  message?: string;
  raw?: Record<string, unknown>;
};

export type SupplierCancellationResult = {
  success: boolean;
  cancelled: boolean;
  externalOrderId?: string;
  status: SupplierOrderStatus;
  retryable?: boolean;
  message?: string;
  raw?: Record<string, unknown>;
  apiUsage?: SupplierApiUsage;
};
