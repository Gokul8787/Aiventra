export class RecoveryError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly retryable: boolean,
    public readonly metadata: Record<string, unknown> = {}
  ) {
    super(message);
    this.name = "RecoveryError";
  }
}

export class RecoveryRetryableError extends RecoveryError {
  constructor(
    message: string,
    code = "RECOVERY_TEMPORARY_FAILURE",
    metadata: Record<string, unknown> = {}
  ) {
    super(message, code, true, metadata);
    this.name = "RecoveryRetryableError";
  }
}

export class RecoveryPermanentError extends RecoveryError {
  constructor(
    message: string,
    code = "RECOVERY_PERMANENT_FAILURE",
    metadata: Record<string, unknown> = {}
  ) {
    super(message, code, false, metadata);
    this.name = "RecoveryPermanentError";
  }
}
