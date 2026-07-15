import { describe, expect, it } from "vitest";

import { calculateOverallScoreFromEngineOutputs } from "./OverallScoreCalculator";
import type { IntelligenceEngineOutputs } from "./core/IntelligenceEngine";

function output(score: number, weight: number) {
  return {
    score,
    weight,
    version: "test",
    result: {},
  };
}

describe("calculateOverallScoreFromEngineOutputs", () => {
  it("calculates the overall score from all engine outputs generically", () => {
    const baseOutputs: IntelligenceEngineOutputs = {
      demand: output(80, 0.5),
      profit: output(80, 0.5),
    };
    const withPluginOutputs: IntelligenceEngineOutputs = {
      ...baseOutputs,
      customQuality: output(20, 0.5),
    };

    expect(calculateOverallScoreFromEngineOutputs(baseOutputs).overallScore).toBe(
      80
    );
    expect(
      calculateOverallScoreFromEngineOutputs(withPluginOutputs).overallScore
    ).toBe(60);
  });

  it("returns each engine score by engine id", () => {
    const result = calculateOverallScoreFromEngineOutputs({
      demand: output(72, 0.2),
      customQuality: output(91, 0.1),
    });

    expect(result.scores).toEqual({
      demand: 72,
      customQuality: 91,
    });
  });
});
