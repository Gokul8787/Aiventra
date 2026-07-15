import type { Product } from "@/ai/types/product";
import type { IntelligenceEngine } from "./core/IntelligenceEngine";
import { SCORE_WEIGHTS } from "./scoreEngine";
import { ConfidenceAnalysis, ConfidenceInput } from "./types";
import type {
  EvidenceMetric,
  EvidenceSource,
  ProductEvidence,
} from "@/ai/evidence/types";

export const REQUIRED_CONFIDENCE_METRICS: EvidenceMetric[] = [
  "demand",
  "competition",
  "supplier",
  "shipping",
  "stock",
  "price",
  "reviews",
];

export const SOURCE_RELIABILITY: Record<EvidenceSource, number> = {
  cj: 90,
  google_trends: 85,
  amazon: 80,
  reddit: 60,
  tiktok: 65,
  reviews: 75,
  shopify: 95,
  internal: 70,
};

function clamp(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function average(values: number[], fallback = 0) {
  if (values.length === 0) return fallback;

  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function getEffectiveReliability(evidence: ProductEvidence) {
  const sourceReliability = SOURCE_RELIABILITY[evidence.source] ?? 50;
  const declaredReliability = evidence.verified
    ? evidence.reliability
    : Math.min(evidence.reliability, 25);

  return clamp((sourceReliability + declaredReliability) / 2);
}

function calculateFreshnessFromObservedAt(observedAt: string) {
  const ageMs = Date.now() - new Date(observedAt).getTime();
  const ageDays = ageMs / (24 * 60 * 60 * 1000);

  if (!Number.isFinite(ageDays) || ageDays < 0) return 50;
  if (ageDays < 1) return 100;
  if (ageDays <= 3) return 90;
  if (ageDays <= 7) return 75;
  if (ageDays <= 30) return 50;

  return 20;
}

function calculateWeightedFreshness(evidence: ProductEvidence[]) {
  if (evidence.length === 0) return 0;

  let totalWeight = 0;
  let totalScore = 0;

  for (const item of evidence) {
    const reliability = getEffectiveReliability(item);
    const freshness = Math.min(
      calculateFreshnessFromObservedAt(item.observedAt),
      item.freshness
    );

    totalScore += freshness * reliability;
    totalWeight += reliability;
  }

  return totalWeight > 0 ? totalScore / totalWeight : 0;
}

function groupEvidenceByMetric(evidence: ProductEvidence[]) {
  const grouped = new Map<EvidenceMetric, ProductEvidence[]>();

  for (const item of evidence) {
    grouped.set(item.metric, [...(grouped.get(item.metric) || []), item]);
  }

  return grouped;
}

function getIndependentSourceScores(evidence: ProductEvidence[]) {
  const bestScoreBySource = new Map<EvidenceSource, number>();

  for (const item of evidence) {
    const existing = bestScoreBySource.get(item.source);

    if (existing === undefined) {
      bestScoreBySource.set(item.source, item.normalizedScore);
    } else {
      bestScoreBySource.set(
        item.source,
        (existing + item.normalizedScore) / 2
      );
    }
  }

  return Array.from(bestScoreBySource.values()).map(clamp);
}

function calculateAgreement(input: {
  groupedEvidence: Map<EvidenceMetric, ProductEvidence[]>;
  requiredMetrics: EvidenceMetric[];
}) {
  const agreementScores: number[] = [];
  const conflictingMetrics: EvidenceMetric[] = [];

  for (const metric of input.requiredMetrics) {
    const scores = getIndependentSourceScores(
      input.groupedEvidence.get(metric) || []
    );

    if (scores.length < 2) continue;

    const minimum = Math.min(...scores);
    const maximum = Math.max(...scores);

    if (maximum - minimum >= 40) {
      conflictingMetrics.push(metric);
    }

    const mean = average(scores);
    const averageDeviation = average(
      scores.map((score) => Math.abs(score - mean))
    );

    agreementScores.push(clamp(100 - averageDeviation * 2));
  }

  return {
    agreementScore: clamp(average(agreementScores, 50)),
    conflictingMetrics,
  };
}

export function analyzeConfidence(input: ConfidenceInput): ConfidenceAnalysis {
  const evidence = input.evidence || [];
  const groupedEvidence = groupEvidenceByMetric(evidence);
  const metricsWithEvidence = input.requiredMetrics.filter(
    (metric) => (groupedEvidence.get(metric)?.length || 0) > 0
  );
  const missingMetrics = input.requiredMetrics.filter(
    (metric) => !metricsWithEvidence.includes(metric)
  );
  const verifiedEvidenceCount = evidence.filter((item) => item.verified).length;
  const sourceCount = new Set(evidence.map((item) => item.source)).size;

  const completenessScore = clamp(
    (metricsWithEvidence.length / input.requiredMetrics.length) * 100
  );
  const freshnessScore = clamp(calculateWeightedFreshness(evidence));
  const reliabilityScore = clamp(
    average(evidence.map(getEffectiveReliability))
  );
  const verifiedRatio = evidence.length
    ? (verifiedEvidenceCount / evidence.length) * 100
    : 0;
  const { agreementScore, conflictingMetrics } = calculateAgreement({
    groupedEvidence,
    requiredMetrics: input.requiredMetrics,
  });

  let confidence =
    completenessScore * 0.3 +
    reliabilityScore * 0.25 +
    freshnessScore * 0.2 +
    agreementScore * 0.2 +
    verifiedRatio * 0.05;

  confidence -= missingMetrics.length * 10;
  confidence -= conflictingMetrics.length * 8;

  if (verifiedEvidenceCount === 0) confidence -= 15;
  if (sourceCount <= 1) confidence -= 10;

  let confidenceScore = clamp(confidence);

  if (sourceCount <= 1 && evidence.length > 0) {
    confidenceScore = Math.min(confidenceScore, 65);
  }

  const confidenceRisk =
    confidenceScore >= 75 ? "low" : confidenceScore >= 45 ? "medium" : "high";

  return {
    confidenceScore,
    confidenceRisk,
    evidenceCount: evidence.length,
    verifiedEvidenceCount,
    sourceCount,
    completenessScore,
    freshnessScore,
    reliabilityScore,
    agreementScore,
    missingMetrics,
    conflictingMetrics,
    reason:
      `Confidence is ${confidenceScore}% from ${evidence.length} evidence records ` +
      `across ${sourceCount} sources. Missing metrics: ${
        missingMetrics.join(", ") || "none"
      }. Conflicts: ${conflictingMetrics.join(", ") || "none"}.`,
  };
}

export class ConfidenceEngine implements IntelligenceEngine<ConfidenceAnalysis> {
  readonly id = "confidence";
  readonly name = "Confidence";
  readonly version = "1.0.0";
  readonly weight = SCORE_WEIGHTS.confidence;
  readonly enabled = true;
  readonly required = true;

  execute(product: Product): ConfidenceAnalysis {
    return analyzeConfidence({
      evidence: product.evidence ?? [],
      requiredMetrics: REQUIRED_CONFIDENCE_METRICS,
    });
  }

  getScore(result: ConfidenceAnalysis): number {
    return result.confidenceScore;
  }
}
