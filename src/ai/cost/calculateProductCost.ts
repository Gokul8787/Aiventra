import type { Product } from "@/ai/types/product";
import { DEFAULT_UK_COST_CONFIGURATION } from "./config";
import { analyseProductCost } from "./costEngine";
import { CostAnalysis } from "./types";

function getVerifiedShippingCost(product: Product) {
  const shippingEvidence = product.evidenceRecords
    ?.filter((evidence) => evidence.category === "shipping")
    .sort(
      (a, b) =>
        Number(b.verified) - Number(a.verified) ||
        b.quality - a.quality ||
        new Date(b.retrievedAt).getTime() - new Date(a.retrievedAt).getTime()
    )[0];
  const data = shippingEvidence?.data as
    | { shippingCost?: unknown; cost?: unknown }
    | undefined;
  const parsed = Number(data?.shippingCost ?? data?.cost);

  return Number.isFinite(parsed) ? parsed : undefined;
}

export function calculateProductCost(product: Product): CostAnalysis {
  const config = DEFAULT_UK_COST_CONFIGURATION;
  const shippingCost = getVerifiedShippingCost(product) ?? 3.99;
  const hasVerifiedShipping = product.evidenceRecords?.some(
    (evidence) => evidence.category === "shipping" && evidence.verified
  );

  return analyseProductCost({
    calculationType: hasVerifiedShipping ? "actual" : "estimated",
    currency: product.currency || "GBP",

    sellPrice: product.sellPrice,
    supplierCost: product.supplierPrice,
    shippingCost,

    paymentFeePercent: config.paymentFeePercent,
    paymentFeeFixed: config.paymentFeeFixed,

    monthlyPlatformFee: config.monthlyPlatformFee,
    expectedMonthlyOrders: config.expectedMonthlyOrders,

    advertisingCostPerOrder: config.advertisingCostPerOrder,
    expectedReturnRatePercent: config.expectedReturnRatePercent,
    currencyConversionFeePercent: config.currencyConversionFeePercent,

    vatRatePercent: config.vatRatePercent,
    pricesIncludeVat: config.pricesIncludeVat,

    otherCostsPerOrder: config.otherCostsPerOrder,
  });
}
