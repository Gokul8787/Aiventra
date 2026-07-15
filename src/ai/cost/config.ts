export interface CostEngineConfiguration {
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

export const DEFAULT_UK_COST_CONFIGURATION: CostEngineConfiguration = {
  // Initial estimates only. Replace with actual store/payment settings later.
  paymentFeePercent: 2.0,
  paymentFeeFixed: 0.25,

  monthlyPlatformFee: 25,
  expectedMonthlyOrders: 250,

  advertisingCostPerOrder: 7,
  expectedReturnRatePercent: 5,
  currencyConversionFeePercent: 1.5,

  vatRatePercent: 0,
  pricesIncludeVat: true,

  otherCostsPerOrder: 0,
};
