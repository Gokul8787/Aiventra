import type { Product } from "@/ai/types/product";
import type { TenantContext } from "@/context/storeContext";
import { getEvidenceProviders } from "./EvidenceRegistry";
import { mergeProductEvidence } from "./ProductEvidenceBridge";
import { verifyEvidence } from "./VerificationEngine";
import type { Evidence } from "./types";

export async function collectEvidence(input: {
  tenantContext: TenantContext;
  product: Product;
}): Promise<{
  product: Product;
  evidence: Evidence[];
}> {
  const evidence: Evidence[] = [...(input.product.evidenceRecords || [])];

  for (const provider of getEvidenceProviders()) {
    try {
      const result = await provider.collect(input);

      if (result) evidence.push(result);
    } catch (error) {
      evidence.push({
        id: crypto.randomUUID(),
        provider: provider.id,
        category: provider.category,
        verified: false,
        confidence: 0,
        quality: 0,
        retrievedAt: new Date().toISOString(),
        cost: 0,
        latency: 0,
        data: {
          error: error instanceof Error ? error.message : "Unknown provider failure",
        },
      });
    }
  }

  const verification = verifyEvidence(evidence);

  return {
    evidence,
    product: {
      ...input.product,
      evidenceRecords: evidence,
      evidence: mergeProductEvidence(input.product.evidence, evidence),
      verification,
    },
  };
}
