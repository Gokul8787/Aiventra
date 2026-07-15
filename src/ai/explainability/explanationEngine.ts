import type { Product } from "@/ai/types/product";
import type { ExplanationItem, ExplainableDecision } from "./types";

const EXPLANATION_VERSION = "1.0.0";

type ExplanationSource = {
  engine: string;
  title: string;
  category: string;
  score: number;
  weight: number;
  reason: string;
};

function round(value: number) {
  return Math.round(value * 100) / 100;
}

function impactForScore(score: number): ExplanationItem["impact"] {
  return score >= 60 ? "positive" : "negative";
}

function contribution(item: ExplanationItem) {
  const weighted = round(item.score * item.weight);

  return item.impact === "positive" ? weighted : -weighted;
}

function toItem(source: ExplanationSource): ExplanationItem {
  return {
    engine: source.engine,
    title: source.title,
    weight: source.weight,
    reason: source.reason,
    score: round(source.score),
    impact: impactForScore(source.score),
  };
}

function buildSummary(input: {
  decision: string;
  finalScore: number;
  positives: ExplanationItem[];
  negatives: ExplanationItem[];
}) {
  const positiveTitles = input.positives.slice(0, 2).map((item) => item.title);
  const negativeTitles = input.negatives.slice(0, 1).map((item) => item.title);

  if (positiveTitles.length === 0 && negativeTitles.length === 0) {
    return `${input.decision} with an AI score of ${input.finalScore}.`;
  }

  const positiveText =
    positiveTitles.length > 0
      ? `supported by ${positiveTitles.join(" and ")}`
      : "with limited positive evidence";
  const negativeText =
    negativeTitles.length > 0 ? `, tempered by ${negativeTitles[0]}` : "";

  return `${input.decision} with an AI score of ${input.finalScore}, ${positiveText}${negativeText}.`;
}

export function generateExplanation(product: Product): ExplainableDecision {
  const intelligence = product.intelligence;
  const decision = product.decision?.decision || "REVIEW";
  const finalScore = intelligence?.overallScore ?? product.aiScore ?? 0;
  const confidence =
    product.decision?.confidence ||
    intelligence?.confidence.confidenceScore ||
    0;

  const sources: ExplanationSource[] = intelligence
    ? [
        {
          engine: "Demand Engine",
          title: "Demand",
          category: "trend",
          score: intelligence.demand.demandScore,
          weight: 0.2,
          reason: intelligence.demand.reason,
        },
        {
          engine: "Competition Engine",
          title: "Competition",
          category: "competition",
          score: intelligence.competition.competitionOpportunityScore,
          weight: 0.15,
          reason: intelligence.competition.reason,
        },
        {
          engine: "Profit Engine",
          title: "Profit",
          category: "product_cost",
          score: intelligence.profit.profitScore,
          weight: 0.2,
          reason: `Estimated net margin ${intelligence.profit.margin}% with ${intelligence.profit.roi}% ROI.`,
        },
        {
          engine: "Supplier Engine",
          title: "Supplier",
          category: "supplier",
          score: intelligence.supplier.supplierScore,
          weight: 0.1,
          reason: intelligence.supplier.reason,
        },
        {
          engine: "Shipping Engine",
          title: "Shipping",
          category: "shipping",
          score: intelligence.shipping.shippingScore,
          weight: 0.1,
          reason: intelligence.shipping.reason,
        },
        {
          engine: "Review Engine",
          title: "Reviews",
          category: "reviews",
          score: intelligence.reviews.reviewScore,
          weight: 0.1,
          reason: intelligence.reviews.reason,
        },
        {
          engine: "Seasonality Engine",
          title: "Seasonality",
          category: "trend",
          score: intelligence.seasonality.seasonalityScore,
          weight: 0.05,
          reason: intelligence.seasonality.reason,
        },
        {
          engine: "Confidence Engine",
          title: "Confidence",
          category: "confidence",
          score: intelligence.confidence.confidenceScore,
          weight: 0.1,
          reason: intelligence.confidence.reason,
        },
      ]
    : [];

  const items = sources
    .map((source) => {
      const verification =
        intelligence?.verification?.byCategory[source.category] ||
        intelligence?.verification;
      const item = toItem(source);

      return {
        ...item,
        dataQuality: verification?.status,
        evidenceCount: verification?.evidenceCount,
        verified: verification?.status === "verified",
      };
    })
    .sort((a, b) => Math.abs(contribution(b)) - Math.abs(contribution(a)));
  const positives = items
    .filter((item) => item.impact === "positive")
    .sort((a, b) => contribution(b) - contribution(a));
  const negatives = items
    .filter((item) => item.impact === "negative")
    .sort((a, b) => contribution(a) - contribution(b));

  return {
    finalScore: round(finalScore),
    confidence: round(confidence),
    decision,
    summary: buildSummary({
      decision,
      finalScore: round(finalScore),
      positives,
      negatives,
    }),
    items,
    generatedAt: new Date().toISOString(),
    version: EXPLANATION_VERSION,
  };
}
