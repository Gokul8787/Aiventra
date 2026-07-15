import type { ConfidenceAnalysis } from "./types";
import type { IntelligenceEngineOutputs } from "./ProductIntelligenceResultBuilder";
import type { IntelligenceDataQuality } from "./productIntelligenceTypes";

function getConfidenceOutput(
  engineOutputs: IntelligenceEngineOutputs
): ConfidenceAnalysis | null {
  const confidence = engineOutputs.confidence;

  if (!confidence || typeof confidence !== "object") return null;

  return confidence.result as ConfidenceAnalysis;
}

export function calculateDataQuality(
  engineOutputs: IntelligenceEngineOutputs
): IntelligenceDataQuality {
  const confidence = getConfidenceOutput(engineOutputs);

  if (!confidence) {
    return {
      status: "estimated",
      estimatedFields: ["confidence"],
    };
  }

  const estimatedFields = confidence.missingMetrics;

  if (
    confidence.verifiedEvidenceCount >= 5 &&
    confidence.completenessScore >= 85 &&
    confidence.sourceCount >= 3
  ) {
    return {
      status: "verified",
      estimatedFields,
    };
  }

  if (
    confidence.verifiedEvidenceCount >= 2 &&
    confidence.completenessScore >= 50
  ) {
    return {
      status: "mixed",
      estimatedFields,
    };
  }

  return {
    status: "estimated",
    estimatedFields,
  };
}
