import type {
  SupplierCapability,
  SupplierCancellationResult,
  SupplierInventoryInput,
  SupplierInventoryResult,
  SupplierOrderCreationInput,
  SupplierOrderCreationResult,
  SupplierOrderStatusResult,
  SupplierTrackingResult,
  SupplierPriceInput,
  SupplierPriceResult,
  SupplierProvider,
  SupplierShippingQuoteInput,
  SupplierShippingQuoteResult,
} from "./types";

export interface SupplierConnector {
  readonly id: SupplierProvider;
  readonly name: string;
  readonly capabilities: readonly SupplierCapability[];

  testConnection(): Promise<{
    success: boolean;
    message: string;
  }>;

  checkInventory(
    input: SupplierInventoryInput
  ): Promise<SupplierInventoryResult>;

  getCurrentPrice(input: SupplierPriceInput): Promise<SupplierPriceResult>;

  getShippingQuote(
    input: SupplierShippingQuoteInput
  ): Promise<SupplierShippingQuoteResult>;

  createOrder(
    input: SupplierOrderCreationInput
  ): Promise<SupplierOrderCreationResult>;

  getOrderStatus(externalOrderId: string): Promise<SupplierOrderStatusResult>;

  getTracking(externalOrderId: string): Promise<SupplierTrackingResult>;

  cancelOrder(externalOrderId: string): Promise<SupplierCancellationResult>;
}
