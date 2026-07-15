import assert from "node:assert/strict";
import { describe, it } from "vitest";

import type { EvidenceMetric, ProductEvidence } from "@/ai/evidence/types";
import {
  analyzeConfidence,
  REQUIRED_CONFIDENCE_METRICS,
} from "./confidenceEngine";

const now = new Date().toISOString();

function evidence(
  source: ProductEvidence["source"],
  metric: EvidenceMetric,
  score: number,
  overrides: Partial<ProductEvidence> = {}
): ProductEvidence {
  return {
    source,
    metric,
    value: score,
    normalizedScore: score,
    reliability: 90,
    freshness: 100,
    completeness: 100,
    observedAt: now,
    verified: true,
    ...overrides,
  };
}

function analyze(items: ProductEvidence[]) {
  return analyzeConfidence({
    evidence: items,
    requiredMetrics: REQUIRED_CONFIDENCE_METRICS,
  });
}

describe("analyzeConfidence", () => {
  it("gives high confidence to fresh verified evidence from multiple agreeing sources", () => {
    const result = analyze([
      evidence("google_trends", "demand", 82),
      evidence("reddit", "demand", 78),
      evidence("amazon", "competition", 74),
      evidence("cj", "supplier", 88),
      evidence("cj", "shipping", 82),
      evidence("cj", "stock", 90),
      evidence("cj", "price", 100),
      evidence("reviews", "reviews", 80),
    ]);

    assert.equal(result.missingMetrics.length, 0);
    assert.equal(result.conflictingMetrics.length, 0);
    assert.ok(result.confidenceScore >= 75);
  });

  it("caps one-source confidence below high confidence", () => {
    const result = analyze(
      REQUIRED_CONFIDENCE_METRICS.map((metric) => evidence("cj", metric, 90))
    );

    assert.equal(result.sourceCount, 1);
    assert.ok(result.confidenceScore <= 65);
  });

  it("penalizes missing required metrics", () => {
    const result = analyze([
      evidence("cj", "price", 100),
      evidence("cj", "stock", 80),
    ]);

    assert.ok(result.missingMetrics.includes("demand"));
    assert.ok(result.confidenceScore < 50);
  });

  it("reduces confidence for old data", () => {
    const recent = analyze([evidence("cj", "price", 90)]);
    const old = analyze([
      evidence("cj", "price", 90, {
        observedAt: new Date(
          Date.now() - 40 * 24 * 60 * 60 * 1000
        ).toISOString(),
      }),
    ]);

    assert.ok(old.freshnessScore < recent.freshnessScore);
  });

  it("detects conflicting provider signals", () => {
    const result = analyze([
      evidence("google_trends", "demand", 92),
      evidence("reddit", "demand", 25),
      evidence("amazon", "demand", 45),
    ]);

    assert.ok(result.conflictingMetrics.includes("demand"));
  });

  it("keeps unverified evidence low confidence", () => {
    const result = analyze([
      evidence("reddit", "demand", 80, {
        verified: false,
        reliability: 10,
      }),
    ]);

    assert.equal(result.verifiedEvidenceCount, 0);
    assert.ok(result.confidenceScore < 40);
  });

  it("treats complete CJ data without demand evidence as mixed at best", () => {
    const result = analyze([
      evidence("cj", "price", 100),
      evidence("cj", "stock", 90),
      evidence("cj", "shipping", 75),
      evidence("cj", "supplier", 80),
    ]);

    assert.ok(result.missingMetrics.includes("demand"));
    assert.ok(result.confidenceScore < 65);
  });
});
