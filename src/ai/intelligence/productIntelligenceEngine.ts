import "./core/registerDefaultEngines";

import type { Product } from "@/ai/types/product";
import type { ProductIntelligence } from "./productIntelligenceTypes";
import { getRegisteredEngines } from "./core/IntelligenceRegistry";
import { calculateDataQuality } from "./DataQualityCalculator";
import { calculateOverallScoreFromEngineOutputs } from "./OverallScoreCalculator";
import type { IntelligenceEngineOutputs } from "./ProductIntelligenceResultBuilder";
import { buildProductIntelligenceFromEngineOutputs } from "./ProductIntelligenceResultBuilder";

export async function analyzeProductIntelligence(
  product: Product
): Promise<ProductIntelligence> {
  const engineOutputs: IntelligenceEngineOutputs = {};

  for (const engine of getRegisteredEngines()) {
    if (!engine.enabled) continue;

    const result = await engine.execute(product);

    engineOutputs[engine.id] = {
      score: Math.max(0, Math.min(100, Math.round(engine.getScore(result)))),
      weight: engine.weight,
      version: engine.version,
      result,
    };
  }

  const { overallScore } = calculateOverallScoreFromEngineOutputs(engineOutputs);
  const dataQuality = calculateDataQuality(engineOutputs);

  return buildProductIntelligenceFromEngineOutputs({
    engineOutputs,
    overallScore,
    dataQuality,
    verification: product.verification,
  });
}
