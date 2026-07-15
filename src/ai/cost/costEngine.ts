import { CostAnalysis, CostInput } from "./types";

const ENGINE_VERSION = "1.0.0";

function roundCurrency(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function roundScore(value: number): number {
  return Math.round(Math.max(0, Math.min(100, value)));
}

function calculateProfitScore(input: {
  netProfit: number;
  netMarginPercent: number;
  roiPercent: number;
}): number {
  const netProfitScore =
    input.netProfit >= 20
      ? 100
      : input.netProfit >= 15
        ? 90
        : input.netProfit >= 10
          ? 75
          : input.netProfit >= 5
            ? 55
            : input.netProfit > 0
              ? 30
              : 0;

  const marginScore =
    input.netMarginPercent >= 40
      ? 100
      : input.netMarginPercent >= 30
        ? 85
        : input.netMarginPercent >= 20
          ? 65
          : input.netMarginPercent >= 10
            ? 40
            : 10;

  const roiScore =
    input.roiPercent >= 70
      ? 100
      : input.roiPercent >= 50
        ? 85
        : input.roiPercent >= 30
          ? 65
          : input.roiPercent >= 10
            ? 40
            : 10;

  return roundScore(
    netProfitScore * 0.4 + marginScore * 0.35 + roiScore * 0.25
  );
}

export function analyseProductCost(input: CostInput): CostAnalysis {
  const revenue = Math.max(0, input.sellPrice);

  const paymentFee =
    revenue * (input.paymentFeePercent / 100) + input.paymentFeeFixed;

  const platformFeeAllocation =
    input.expectedMonthlyOrders > 0
      ? input.monthlyPlatformFee / input.expectedMonthlyOrders
      : 0;

  const returnAllowance =
    revenue * (input.expectedReturnRatePercent / 100);

  const currencyConversionFee =
    revenue * (input.currencyConversionFeePercent / 100);

  const vatRate = input.vatRatePercent / 100;

  const vatReserve =
    input.vatRatePercent <= 0
      ? 0
      : input.pricesIncludeVat
        ? revenue - revenue / (1 + vatRate)
        : revenue * vatRate;

  const costs = {
    supplierCost: input.supplierCost,
    shippingCost: input.shippingCost,
    paymentFee,
    platformFeeAllocation,
    advertisingCost: input.advertisingCostPerOrder,
    returnAllowance,
    currencyConversionFee,
    vatReserve,
    otherCosts: input.otherCostsPerOrder,
  };

  const grossProfit = revenue - costs.supplierCost - costs.shippingCost;

  const totalNonAdvertisingCost =
    costs.supplierCost +
    costs.shippingCost +
    costs.paymentFee +
    costs.platformFeeAllocation +
    costs.returnAllowance +
    costs.currencyConversionFee +
    costs.vatReserve +
    costs.otherCosts;

  const preAdvertisingProfit = revenue - totalNonAdvertisingCost;
  const totalCost = totalNonAdvertisingCost + costs.advertisingCost;
  const netProfit = revenue - totalCost;

  const grossMarginPercent =
    revenue > 0 ? (grossProfit / revenue) * 100 : 0;

  const netMarginPercent = revenue > 0 ? (netProfit / revenue) * 100 : 0;
  const roiPercent = totalCost > 0 ? (netProfit / totalCost) * 100 : 0;
  const maximumAffordableCPA = Math.max(0, preAdvertisingProfit);
  const breakEvenROAS =
    maximumAffordableCPA > 0 ? revenue / maximumAffordableCPA : 0;

  const profitScore = calculateProfitScore({
    netProfit,
    netMarginPercent,
    roiPercent,
  });

  return {
    calculationType: input.calculationType ?? "estimated",
    currency: input.currency,

    revenue: roundCurrency(revenue),
    grossProfit: roundCurrency(grossProfit),
    preAdvertisingProfit: roundCurrency(preAdvertisingProfit),
    netProfit: roundCurrency(netProfit),

    grossMarginPercent: roundCurrency(grossMarginPercent),
    netMarginPercent: roundCurrency(netMarginPercent),
    roiPercent: roundCurrency(roiPercent),
    breakEvenROAS: roundCurrency(breakEvenROAS),
    maximumAffordableCPA: roundCurrency(maximumAffordableCPA),

    totalNonAdvertisingCost: roundCurrency(totalNonAdvertisingCost),
    totalCost: roundCurrency(totalCost),

    profitScore,
    financiallyViable:
      netProfit > 0 && netMarginPercent >= 15 && maximumAffordableCPA > 0,

    costs: {
      supplierCost: roundCurrency(costs.supplierCost),
      shippingCost: roundCurrency(costs.shippingCost),
      paymentFee: roundCurrency(costs.paymentFee),
      platformFeeAllocation: roundCurrency(costs.platformFeeAllocation),
      advertisingCost: roundCurrency(costs.advertisingCost),
      returnAllowance: roundCurrency(costs.returnAllowance),
      currencyConversionFee: roundCurrency(costs.currencyConversionFee),
      vatReserve: roundCurrency(costs.vatReserve),
      otherCosts: roundCurrency(costs.otherCosts),
    },

    calculatedAt: new Date().toISOString(),
    engineVersion: ENGINE_VERSION,
  };
}
