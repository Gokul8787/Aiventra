export interface ExplanationItem {
  engine: string;
  title: string;
  score: number;
  weight: number;
  impact: "positive" | "negative";
  reason: string;
  dataQuality?: string;
  evidenceCount?: number;
  verified?: boolean;
}

export interface ExplainableDecision {
  finalScore: number;
  confidence: number;
  decision: string;
  summary: string;
  items: ExplanationItem[];
  generatedAt: string;
  version: string;
}
