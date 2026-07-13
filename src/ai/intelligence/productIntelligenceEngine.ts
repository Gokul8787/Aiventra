import { Product } from "@/ai/types/product";
import { analyzeCompetition } from "./competitionEngine";
import { analyzeConfidence } from "./confidenceEngine";
import { analyzeDemand } from "./demandEngine";
import { analyzeProfit } from "./profitEngine";
import { analyzeReviews } from "./reviewEngine";
import { analyzeSeasonality } from "./seasonalityEngine";
import { analyzeShipping } from "./shippingEngine";
import { analyzeSupplier } from "./supplierEngine";
import { calculateOverallScore } from "./scoreEngine";

export function analyzeProductIntelligence(product: Product) {
  const profit = analyzeProfit({
    supplierCost: product.supplierPrice,
    shippingCost: 3.99,
    sellPrice: product.sellPrice,
    platformFeePercent: 2.9,
    estimatedAdCost: 6,
    returnAllowancePercent: 3,
  });

  const shipping = analyzeShipping({
    shippingDays: product.shippingDays,
    shippingCost: 3.99,
    availableToUK: true,
  });

  const supplier = analyzeSupplier({
    supplierRating: 4.5,
    fulfilmentRate: 92,
    orderHistory: 1200,
  });

  const reviews = analyzeReviews({
    averageRating: 4.6,
    reviewCount: 850,
    sentimentScore: 88,
  });

  const seasonality = analyzeSeasonality({
    currentMonth: new Date().getMonth() + 1,
    peakMonths: [11, 12, 1],
  });

  const demand = analyzeDemand({
    trendScore: product.trendScore,
    searchVolumeScore: 75,
    socialMentionsScore: 70,
  });

  const competition = analyzeCompetition({
    competitionScore: product.competitionScore,
    sellerCountScore: 60,
    priceSaturationScore: 55,
  });

  const confidence = analyzeConfidence({
    dataCompletenessScore: 80,
    providerAgreementScore: 75,
    dataFreshnessScore: 85,
  });

  const dataQuality = {
    status: "mixed" as const,
    estimatedFields: [
      "shippingCost",
      "advertisingCost",
      "returnAllowance",
      "supplierRating",
      "fulfilmentRate",
      "supplierOrderHistory",
      "averageRating",
      "reviewCount",
      "reviewSentiment",
      "searchVolume",
      "socialMentions",
      "sellerCount",
      "priceSaturation",
      "providerAgreement",
    ],
  };

  const overallScore = calculateOverallScore({
    demand: demand.demandScore,
    competition: competition.competitionOpportunityScore,
    profit: profit.profitScore,
    supplier: supplier.supplierScore,
    shipping: shipping.shippingScore,
    reviews: reviews.reviewScore,
    seasonality: seasonality.seasonalityScore,
    confidence: confidence.confidenceScore,
  });

  return {
    demand,
    competition,
    profit,
    shipping,
    supplier,
    reviews,
    seasonality,
    confidence,
    overallScore,
    dataQuality,
  };
}
