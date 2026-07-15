import type {
  CategoryVerificationSummary,
  Evidence,
  EvidenceVerificationStatus,
  VerificationSummary,
} from "./types";

const REQUIRED_CATEGORIES = [
  "shipping",
  "inventory",
  "product_cost",
  "trend",
  "competition",
  "reviews",
];

function clamp(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function average(values: number[], fallback = 0) {
  if (values.length === 0) return fallback;

  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function calculateFreshness(evidence: Evidence) {
  const now = Date.now();
  const retrievedAt = new Date(evidence.retrievedAt).getTime();
  const expiresAt = evidence.expiresAt
    ? new Date(evidence.expiresAt).getTime()
    : undefined;

  if (!Number.isFinite(retrievedAt)) return 30;
  if (expiresAt && expiresAt <= now) return 20;

  const ageHours = (now - retrievedAt) / (60 * 60 * 1000);

  if (ageHours <= 1) return 100;
  if (ageHours <= 6) return 90;
  if (ageHours <= 24) return 75;
  if (ageHours <= 72) return 55;

  return 25;
}

function statusFromEvidence(input: {
  evidenceCount: number;
  verifiedCount: number;
  dataQuality: number;
}): EvidenceVerificationStatus {
  if (input.evidenceCount === 0) return "missing";
  if (input.verifiedCount === input.evidenceCount && input.dataQuality >= 85) {
    return "verified";
  }
  if (input.verifiedCount > 0 && input.dataQuality >= 55) return "mixed";

  return "estimated";
}

function buildCategorySummary(
  category: string,
  evidence: Evidence[]
): CategoryVerificationSummary {
  const verifiedCount = evidence.filter((item) => item.verified).length;
  const providers = Array.from(new Set(evidence.map((item) => item.provider)));
  const freshnessScore = clamp(average(evidence.map(calculateFreshness)));
  const dataQuality = clamp(
    average(
      evidence.map((item) => {
        const verificationScore = item.verified ? 100 : 25;

        return (
          item.quality * 0.35 +
          item.confidence * 0.25 +
          freshnessScore * 0.25 +
          verificationScore * 0.15
        );
      })
    )
  );
  const latestEvidence = [...evidence].sort(
    (a, b) =>
      new Date(b.retrievedAt).getTime() - new Date(a.retrievedAt).getTime()
  )[0];
  const status = statusFromEvidence({
    evidenceCount: evidence.length,
    verifiedCount,
    dataQuality,
  });
  const blockingReasons: string[] = [];

  if (status === "missing") blockingReasons.push(`${category} evidence missing`);
  if (status === "estimated") {
    blockingReasons.push(`${category} evidence is estimated`);
  }
  if (latestEvidence?.expiresAt && new Date(latestEvidence.expiresAt) <= new Date()) {
    blockingReasons.push(`${category} evidence expired`);
  }

  return {
    category,
    status,
    dataQuality,
    evidenceCount: evidence.length,
    verifiedCount,
    sourceCount: providers.length,
    freshnessScore,
    latestRetrievedAt: latestEvidence?.retrievedAt,
    latestExpiresAt: latestEvidence?.expiresAt,
    providers,
    blockingReasons,
  };
}

export function verifyEvidence(evidence: Evidence[]): VerificationSummary {
  const categories = Array.from(
    new Set([...REQUIRED_CATEGORIES, ...evidence.map((item) => item.category)])
  );
  const byCategory = Object.fromEntries(
    categories.map((category) => [
      category,
      buildCategorySummary(
        category,
        evidence.filter((item) => item.category === category)
      ),
    ])
  );
  const categorySummaries = Object.values(byCategory);
  const evidenceCount = evidence.length;
  const verifiedCount = evidence.filter((item) => item.verified).length;
  const sourceCount = new Set(evidence.map((item) => item.provider)).size;
  const freshnessScore = clamp(average(categorySummaries.map((item) => item.freshnessScore)));
  const coverageScore = clamp(
    (REQUIRED_CATEGORIES.filter(
      (category) => byCategory[category]?.evidenceCount > 0
    ).length /
      REQUIRED_CATEGORIES.length) *
      100
  );
  const dataQuality = clamp(
    average(categorySummaries.map((item) => item.dataQuality)) * 0.7 +
      coverageScore * 0.3
  );
  const blockingReasons = categorySummaries.flatMap(
    (item) => item.blockingReasons
  );
  const status = statusFromEvidence({
    evidenceCount,
    verifiedCount,
    dataQuality,
  });

  return {
    status,
    dataQuality,
    evidenceCount,
    verifiedCount,
    sourceCount,
    freshnessScore,
    coverageScore,
    byCategory,
    blockingReasons,
    generatedAt: new Date().toISOString(),
  };
}
