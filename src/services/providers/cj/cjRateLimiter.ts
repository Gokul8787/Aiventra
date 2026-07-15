import "server-only";

import { supabaseAdmin } from "@/services/supabase/admin";

export type ProviderPermit = {
  granted: boolean;
  retryAfterMs: number;
  permittedAt: string;
};

export async function acquireCJPermit(): Promise<ProviderPermit> {
  const { data, error } = await supabaseAdmin.rpc("acquire_provider_permit", {
    requested_provider: "cj",
  });

  if (error) {
    throw new Error(`Failed to acquire CJ permit: ${error.message}`);
  }

  const row = Array.isArray(data) ? data[0] : data;

  if (!row) {
    throw new Error("CJ permit function returned no result.");
  }

  return {
    granted: Boolean(row.granted),
    retryAfterMs: Number(row.retry_after_ms || 0),
    permittedAt: row.permitted_at,
  };
}
