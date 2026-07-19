import "server-only";

import crypto from "crypto";

export class WorkerAuthenticationError extends Error {
  readonly status = 401;
}

function secureEqual(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

export function requireWorkerSecret(
  request: Request,
  environmentVariable = "AIVENTRA_WORKER_SECRET"
): void {
  const configuredSecret = process.env[environmentVariable]?.trim();

  if (!configuredSecret) {
    throw new WorkerAuthenticationError(
      `${environmentVariable} is not configured.`
    );
  }

  const authorization = request.headers.get("authorization") || "";
  const expected = `Bearer ${configuredSecret}`;

  if (!secureEqual(authorization, expected)) {
    throw new WorkerAuthenticationError("Unauthorized worker request.");
  }
}
