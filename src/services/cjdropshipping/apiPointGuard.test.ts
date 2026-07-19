import { describe, expect, it } from "vitest";

import {
  assertCJApiPointsAvailable,
  CJApiPointsError,
} from "./apiPointGuard";

describe("assertCJApiPointsAvailable", () => {
  it("allows requests when remaining points are undefined", () => {
    expect(() => assertCJApiPointsAvailable(undefined)).not.toThrow();
  });

  it("allows requests when remaining points meet the threshold", () => {
    expect(() => assertCJApiPointsAvailable(10, 10)).not.toThrow();
  });

  it("throws a CJApiPointsError when points are below the threshold", () => {
    expect(() => assertCJApiPointsAvailable(3, 10)).toThrow(CJApiPointsError);
  });
});
