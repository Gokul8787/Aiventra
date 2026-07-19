import { describe, expect, it } from "vitest";

import {
  RecoveryPermanentError,
  RecoveryRetryableError,
} from "./errors";
import { classifyRecoveryFailure } from "./retryPolicy";

describe("classifyRecoveryFailure", () => {
  it("retries temporary recovery failures", () => {
    const result = classifyRecoveryFailure(
      new RecoveryRetryableError("CJ 429 rate limit"),
      1
    );

    expect(result.retry).toBe(true);
    expect(result.moveToDeadLetter).toBe(false);
    expect(result.delaySeconds).toBeGreaterThan(0);
  });

  it("dead-letters permanent recovery failures immediately", () => {
    const result = classifyRecoveryFailure(
      new RecoveryPermanentError("Invalid supplier order"),
      1
    );

    expect(result.retry).toBe(false);
    expect(result.moveToDeadLetter).toBe(true);
  });

  it("dead-letters the fifth temporary failure", () => {
    const result = classifyRecoveryFailure(
      new RecoveryRetryableError("Network timeout"),
      5
    );

    expect(result.retry).toBe(false);
    expect(result.moveToDeadLetter).toBe(true);
  });
});
