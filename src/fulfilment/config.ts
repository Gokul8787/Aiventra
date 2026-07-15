export const FULFILMENT_THRESHOLDS = {
  maximumSupplierCostIncreasePercent: 10,
  maximumShippingCost: 10,
  maximumDeliveryDays: 14,

  minimumNetProfit: 3,
  minimumNetMarginPercent: 15,

  maximumAutoFulfilOrderValue: 150,

  requireVerifiedMapping: true,
  blockOutOfStock: true,
} as const;
