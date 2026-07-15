export type RetryClassification = "retryable" | "permanent";

export function classifyJobError(error: unknown): RetryClassification {
  const message =
    error instanceof Error
      ? error.message.toLowerCase()
      : String(error).toLowerCase();

  const retryablePatterns = [
    "429",
    "too many requests",
    "timeout",
    "timed out",
    "network",
    "fetch failed",
    "502",
    "503",
    "504",
    "temporarily unavailable",
    "connection reset",
  ];

  return retryablePatterns.some((pattern) => message.includes(pattern))
    ? "retryable"
    : "permanent";
}

export function getRetryDelaySeconds(attempt: number): number {
  const delays = [0, 30, 120, 600, 1800];

  return delays[Math.min(Math.max(attempt - 1, 0), delays.length - 1)] || 1800;
}
