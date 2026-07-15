import "server-only";

import { supabaseAdmin } from "@/services/supabase/admin";

export type RateLimitRule = {
  route: string;
  maximumRequests: number;
  windowSeconds: number;
};

export type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  resetAt: string;
};

export class RateLimitError extends Error {
  status = 429;

  constructor(
    message: string,
    public readonly resetAt: string
  ) {
    super(message);
  }
}

export async function enforceRateLimit(
  key: string,
  rule: RateLimitRule
): Promise<RateLimitResult> {
  const { data, error } = await supabaseAdmin.rpc("consume_api_rate_limit", {
    rate_limit_key: key,
    route_name: rule.route,
    maximum_requests: rule.maximumRequests,
    window_seconds: rule.windowSeconds,
  });

  if (error) {
    throw new Error(`Rate limiting failed: ${error.message}`);
  }

  const result = Array.isArray(data) ? data[0] : data;

  if (!result) {
    throw new Error("Rate limiter returned no result.");
  }

  const mapped: RateLimitResult = {
    allowed: Boolean(result.allowed),
    remaining: Number(result.remaining || 0),
    resetAt: result.reset_at,
  };

  if (!mapped.allowed) {
    throw new RateLimitError(
      "Too many requests. Please try again later.",
      mapped.resetAt
    );
  }

  return mapped;
}
