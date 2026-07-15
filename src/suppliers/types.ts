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
