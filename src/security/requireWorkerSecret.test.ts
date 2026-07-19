import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  WorkerAuthenticationError,
  requireWorkerSecret,
} from "./requireWorkerSecret";

describe("requireWorkerSecret", () => {
  it("rejects when the secret is not configured", () => {
    const previous = process.env.AIVENTRA_WORKER_SECRET;
    delete process.env.AIVENTRA_WORKER_SECRET;

    try {
      expect(() =>
        requireWorkerSecret(new Request("http://localhost/internal"))
      ).toThrow(WorkerAuthenticationError);
    } finally {
      process.env.AIVENTRA_WORKER_SECRET = previous;
    }
  });

  it("accepts a valid bearer token", () => {
    const previous = process.env.AIVENTRA_WORKER_SECRET;
    process.env.AIVENTRA_WORKER_SECRET = "secret-123";

    try {
      expect(() =>
        requireWorkerSecret(
          new Request("http://localhost/internal", {
            headers: {
              authorization: "Bearer secret-123",
            },
          })
        )
      ).not.toThrow();
    } finally {
      process.env.AIVENTRA_WORKER_SECRET = previous;
    }
  });
});
