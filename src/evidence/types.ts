import type { Product } from "@/ai/types/product";
import type { TenantContext } from "@/context/storeContext";

export type EvidenceVerificationStatus =
  | "verified"
  | "mixed"
  | "estimated"
  | "missing";

export type EvidenceCategory =
  | "shipping"
  | "inventory"
  | "product_cost"
  | "trend"
  | "competition"
  | "reviews"
  | "advertising_cost"
  | "supplier";

export interface Evidence<T = unknown> {
  id: string;
  provider: string;
  category: EvidenceCategory | string;
  verified: boolean;
  confidence: number;
  quality: number;
  retrievedAt: string;
  expiresAt?: string;
  cost: number;
  latency: number;
  data: T;
}

export interface EvidenceProvider<TResult = unknown> {
  readonly id: string;
  readonly name: string;
  readonly category: EvidenceCategory | string;
  readonly version: string;
  readonly cacheTtlSeconds: number;
  readonly enabled: boolean;

  collect(input: EvidenceProviderInput): Promise<Evidence<TResult> | null>;
}

export type EvidenceProviderInput = {
  tenantContext: TenantContext;
  product: Product;
};

export interface VerificationSummary {
  status: EvidenceVerificationStatus;
  dataQuality: number;
  evidenceCount: number;
  verifiedCount: number;
  sourceCount: number;
  freshnessScore: number;
  coverageScore: number;
  byCategory: Record<string, CategoryVerificationSummary>;
  blockingReasons: string[];
  generatedAt: string;
}

export interface CategoryVerificationSummary {
  category: string;
  status: EvidenceVerificationStatus;
  dataQuality: number;
  evidenceCount: number;
  verifiedCount: number;
  sourceCount: number;
  freshnessScore: number;
  latestRetrievedAt?: string;
  latestExpiresAt?: string;
  providers: string[];
  blockingReasons: string[];
}

export interface ProviderHealth {
  provider: string;
  category: string;
  status: "healthy" | "degraded" | "failed" | "quota_low";
  lastSuccessAt?: string;
  lastFailureAt?: string;
  latencyMs: number;
  cost: number;
  quotaRemaining?: number;
  version: string;
  checkedAt: string;
}
