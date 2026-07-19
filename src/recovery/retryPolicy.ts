import { RECOVERY_CONFIG } from "./config";
import { RecoveryError } from "./errors";

export type RecoveryRetryDecision = {
  retry: boolean;
  delaySeconds: number;
  moveToDeadLetter: boolean;
  reason: string;
};

export function classifyRecoveryFailure(
  error: unknown,
  attempt: number,
  maximumAttempts: number = RECOVERY_CONFIG.maximumAttempts
): RecoveryRetryDecision {
  const retryable =
    error instanceof RecoveryError ? error.retryable : isTemporaryError(error);

  if (!retryable) {
    return {
      retry: false,
      delaySeconds: 0,
      moveToDeadLetter: true,
      reason: "The failure is permanent.",
    };
  }

  if (attempt >= maximumAttempts) {
    return {
      retry: false,
      delaySeconds: 0,
      moveToDeadLetter: true,
      reason: "Maximum retry attempts were exhausted.",
    };
  }

  const delaySeconds =
    RECOVERY_CONFIG.retryDelaysSeconds[
      Math.min(attempt, RECOVERY_CONFIG.retryDelaysSeconds.length - 1)
    ];

  return {
    retry: true,
    delaySeconds,
    moveToDeadLetter: false,
    reason: "Temporary failure will be retried.",
  };
}

function isTemporaryError(error: unknown): boolean {
  const message =
    error instanceof Error
      ? error.message.toLowerCase()
      : String(error).toLowerCase();

  return [
    "429",
    "rate limit",
    "timeout",
    "network",
    "temporarily unavailable",
    "502",
    "503",
    "504",
    "connection reset",
  ].some((pattern) => message.includes(pattern));
}
