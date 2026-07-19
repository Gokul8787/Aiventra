export class CJApiPointsError extends Error {
  constructor(
    message: string,
    readonly remaining?: number,
    readonly required = 10
  ) {
    super(message);
    this.name = "CJApiPointsError";
  }
}

export function assertCJApiPointsAvailable(
  remaining?: number,
  required = 10
): void {
  if (remaining !== undefined && remaining < required) {
    throw new CJApiPointsError(
      `CJ API points are too low. Remaining: ${remaining}, required: ${required}.`,
      remaining,
      required
    );
  }
}
