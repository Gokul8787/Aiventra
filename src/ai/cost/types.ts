export type CostCalculationType = "estimated" | "actual" | "forecast";

export interface CostInput {
  calculationType?: CostCalculationType;

  currency: string;

  sellPrice: number;
  supplierCost: number;
  shippingCost: number;

  paymentFeePercent: number;
  paymentFeeFixed: number;

  monthlyPlatformFee: number;
  expectedMonthlyOrders: number;

  advertisingCostPerOrder: number;
  expectedReturnRatePercent: number;
  currencyConversionFeePercent: number;

  vatRatePercent: number;
  pricesIncludeVat: boolean;

  otherCostsPerOrder: number;
}

export interface CostComponents {
  supplierCost: number;
  shippingCost: number;
  paymentFee: number;
  platformFeeAllocation: number;
  advertisingCost: number;
  returnAllowance: number;
  currencyConversionFee: number;
  vatReserve: number;
  otherCosts: number;
}

export interface CostAnalysis {
  calculationType: CostCalculationType;
  currency: string;

  revenue: number;
  grossProfit: number;
  preAdvertisingProfit: number;
  netProfit: number;

  grossMarginPercent: number;
  netMarginPercent: number;
  roiPercent: number;
  breakEvenROAS: number;
  maximumAffordableCPA: number;

  totalNonAdvertisingCost: number;
  totalCost: number;

  profitScore: number;
  financiallyViable: boolean;

  costs: CostComponents;
  calculatedAt: string;
  engineVersion: string;
}
