import type { Product } from "@/ai/types/product";

export interface IntelligenceEngine<TResult = unknown> {
  readonly id: string;
  readonly name: string;
  readonly version: string;
  readonly weight: number;
  readonly enabled: boolean;
  readonly required: boolean;

  execute(product: Product): Promise<TResult> | TResult;
  getScore(result: TResult): number;
}

export interface IntelligenceEngineOutput<TResult = unknown> {
  score: number;
  weight: number;
  version: string;
  result: TResult;
}

export type IntelligenceEngineOutputs = Record<string, IntelligenceEngineOutput>;
