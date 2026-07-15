import type {
  Evidence,
  EvidenceCategory,
  VerificationSummary,
} from "./types";
import type { ProductEvidence, EvidenceMetric, EvidenceSource } from "@/ai/evidence/types";

const SOURCE_MAP: Record<string, EvidenceSource> = {
  cj: "cj",
  cjdropshipping: "cj",
  google_trends: "google_trends",
  reddit: "reddit",
  amazon: "amazon",
  tiktok: "tiktok",
  shopify: "shopify",
  reviews: "reviews",
  internal: "internal",
};

const METRIC_MAP: Partial<Record<EvidenceCategory | string, EvidenceMetric>> = {
  product_cost: "price",
  inventory: "stock",
  shipping: "shipping",
  trend: "demand",
  competition: "competition",
  reviews: "reviews",
  supplier: "supplier",
};

function toNumber(value: unknown) {
  const parsed = Number(value);

  return Number.isFinite(parsed) ? parsed : 0;
}

function valueFromEvidence(evidence: Evidence) {
  const data = evidence.data as Record<string, unknown>;

  if (evidence.category === "shipping") {
    return toNumber(data.shippingDays ?? data.deliveryDays ?? data.days);
  }

  if (evidence.category === "inventory") {
    return toNumber(data.available ?? data.stock ?? data.inventory);
  }

  if (evidence.category === "product_cost") {
    return toNumber(data.cost ?? data.supplierPrice ?? data.price);
  }

  return toNumber(data.score ?? data.value ?? evidence.quality);
}

export function evidenceToProductEvidence(evidence: Evidence): ProductEvidence | null {
  const metric = METRIC_MAP[evidence.category];

  if (!metric) return null;

  return {
    source: SOURCE_MAP[evidence.provider] || "internal",
    metric,
    value: valueFromEvidence(evidence),
    normalizedScore: evidence.quality,
    reliability: evidence.verified ? evidence.confidence : Math.min(evidence.confidence, 25),
    freshness: evidence.expiresAt && new Date(evidence.expiresAt) <= new Date() ? 20 : 100,
    completeness: evidence.data ? 100 : 0,
    observedAt: evidence.retrievedAt,
    verified: evidence.verified,
    metadata: {
      evidenceId: evidence.id,
      provider: evidence.provider,
      category: evidence.category,
      verificationStatus: evidence.verified ? "verified" : "estimated",
      expiresAt: evidence.expiresAt,
      ...((evidence.data as Record<string, unknown>) || {}),
    },
  };
}

export function mergeProductEvidence(
  existing: ProductEvidence[] | undefined,
  evidence: Evidence[]
) {
  const bridged = evidence.flatMap((item) => {
    const productEvidence = evidenceToProductEvidence(item);

    return productEvidence ? [productEvidence] : [];
  });

  return [...(existing || []), ...bridged];
}

export function getCategoryStatus(
  verification: VerificationSummary | undefined,
  category: string
) {
  return verification?.byCategory[category]?.status || "missing";
}
