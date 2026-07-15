import type {
  IntelligenceDataQuality,
  ProductIntelligence,
  ProductIntelligenceCoreResults,
} from "./productIntelligenceTypes";
import type { IntelligenceEngineOutputs } from "./core/IntelligenceEngine";
import type { VerificationSummary } from "@/evidence/types";
export type { IntelligenceEngineOutputs } from "./core/IntelligenceEngine";

type BuildProductIntelligenceInput = {
  engineOutputs: IntelligenceEngineOutputs;
  overallScore: number;
  dataQuality: IntelligenceDataQuality;
  verification?: VerificationSummary;
};

function getRequiredEngineResult<
  Name extends keyof ProductIntelligenceCoreResults,
>(
  engineOutputs: IntelligenceEngineOutputs,
  engineId: Name
): ProductIntelligenceCoreResults[Name] {
  const output = engineOutputs[engineId];

  if (!output) {
    throw new Error(`Missing intelligence engine output: ${engineId}`);
  }

  return output.result as ProductIntelligenceCoreResults[Name];
}

export function getCoreEngineResults(
  engineOutputs: IntelligenceEngineOutputs
): ProductIntelligenceCoreResults {
  return {
    demand: getRequiredEngineResult(engineOutputs, "demand"),
    competition: getRequiredEngineResult(engineOutputs, "competition"),
    profit: getRequiredEngineResult(engineOutputs, "profit"),
    shipping: getRequiredEngineResult(engineOutputs, "shipping"),
    supplier: getRequiredEngineResult(engineOutputs, "supplier"),
    reviews: getRequiredEngineResult(engineOutputs, "reviews"),
    seasonality: getRequiredEngineResult(engineOutputs, "seasonality"),
    confidence: getRequiredEngineResult(engineOutputs, "confidence"),
  };
}

export function buildProductIntelligenceFromEngineOutputs({
  engineOutputs,
  overallScore,
  dataQuality,
  verification,
}: BuildProductIntelligenceInput): ProductIntelligence {
  return {
    ...getCoreEngineResults(engineOutputs),
    engineOutputs,
    overallScore,
    dataQuality,
    verification,
  };
}
