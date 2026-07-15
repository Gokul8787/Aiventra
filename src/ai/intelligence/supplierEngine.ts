import type { Product } from "@/ai/types/product";
import type { IntelligenceEngine } from "./core/IntelligenceEngine";
import { SCORE_WEIGHTS } from "./scoreEngine";
import { SupplierAnalysis } from "./types";

export class SupplierEngine implements IntelligenceEngine<SupplierAnalysis> {
  readonly id = "supplier";
  readonly name = "Supplier";
  readonly version = "2.0.0";
  readonly weight = SCORE_WEIGHTS.supplier;
  readonly enabled = true;
  readonly required = true;

  execute(product: Product): SupplierAnalysis {
    const reliability = product.supplierReliability;

    if (!reliability) {
      return {
        supplierScore: 0,
        supplierRisk: "high",
        reason: "Supplier reliability analysis is unavailable.",
      };
    }

    return {
      supplierScore: reliability.supplierScore,
      supplierRisk: reliability.supplierRisk,
      reason:
        reliability.reasons.join(" ") ||
        `Supplier reliability is ${reliability.dataQuality} with ${reliability.sampleSize} samples.`,
    };
  }

  getScore(result: SupplierAnalysis): number {
    return result.supplierScore;
  }
}
