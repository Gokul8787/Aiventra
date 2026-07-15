import type {
  SupplierCapability,
  SupplierInventoryInput,
  SupplierInventoryResult,
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
}
