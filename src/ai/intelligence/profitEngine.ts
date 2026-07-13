import { ProfitAnalysis, ProfitInput } from "./types";

function round(value: number) {
  return Math.round(value * 100) / 100;
}

export function analyzeProfit(input: ProfitInput): ProfitAnalysis {
  const platformFee = input.sellPrice * (input.platformFeePercent / 100);
  const returnAllowance = input.sellPrice * (input.returnAllowancePercent / 100);

  const grossProfit =
    input.sellPrice - input.supplierCost - input.shippingCost;

  const netProfit =
    grossProfit - platformFee - input.estimatedAdCost - returnAllowance;

  const margin = input.sellPrice > 0 ? (netProfit / input.sellPrice) * 100 : 0;

  const totalCost =
    input.supplierCost +
    input.shippingCost +
    platformFee +
    input.estimatedAdCost +
    returnAllowance;

  const roi = totalCost > 0 ? (netProfit / totalCost) * 100 : 0;

  const preAdvertisingProfit =
    input.sellPrice -
    input.supplierCost -
    input.shippingCost -
    platformFee -
    returnAllowance;

  const breakEvenROAS =
    preAdvertisingProfit > 0 ? input.sellPrice / preAdvertisingProfit : 0;

  const recommendedSellPrice = round(
    (input.supplierCost + input.shippingCost + input.estimatedAdCost) * 2.5
  );

  let profitScore = 0;

  if (margin >= 50) profitScore = 95;
  else if (margin >= 40) profitScore = 85;
  else if (margin >= 30) profitScore = 70;
  else if (margin >= 20) profitScore = 55;
  else if (margin >= 10) profitScore = 35;
  else profitScore = 15;

  return {
    grossProfit: round(grossProfit),
    netProfit: round(netProfit),
    margin: round(margin),
    roi: round(roi),
    breakEvenROAS: round(breakEvenROAS),
    recommendedSellPrice,
    profitScore,
  };
}
