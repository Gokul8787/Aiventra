import { calculateProductCost } from "@/ai/cost/calculateProductCost";
import type { Product } from "@/ai/types/product";
import type { IntelligenceEngine } from "./core/IntelligenceEngine";
import { SCORE_WEIGHTS } from "./scoreEngine";
import { ProfitAnalysis } from "./types";

export class ProfitEngine implements IntelligenceEngine<ProfitAnalysis> {
  readonly id = "profit";
  readonly name = "Profit";
  readonly version = "2.0.0";
  readonly weight = SCORE_WEIGHTS.profit;
  readonly enabled = true;
  readonly required = true;

  execute(product: Product): ProfitAnalysis {
    const costAnalysis = product.costAnalysis ?? calculateProductCost(product);

    return {
      grossProfit: costAnalysis.grossProfit,
      netProfit: costAnalysis.netProfit,
      margin: costAnalysis.netMarginPercent,
      roi: costAnalysis.roiPercent,
      breakEvenROAS: costAnalysis.breakEvenROAS,
      recommendedSellPrice: product.sellPrice,
      profitScore: costAnalysis.profitScore,
    };
  }

  getScore(result: ProfitAnalysis): number {
    return result.profitScore;
  }
}
