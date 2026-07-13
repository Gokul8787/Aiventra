import "server-only";
import { supabaseAdmin } from "@/services/supabase/admin";
import { SourceStatus } from "@/ai/agents/trendCollector";

export async function saveProviderRuns(
  scanId: string,
  sources: SourceStatus[]
): Promise<void> {
  if (sources.length === 0) return;

  const now = new Date().toISOString();

  const rows = sources.map((source) => ({
    scan_id: scanId,
    provider_name: source.name,
    status: source.status === "success" ? "success" : "failed",
    products_found: source.count,
    error_message: source.error || null,
    started_at: now,
    completed_at: now,
  }));

  const { error } = await supabaseAdmin.from("provider_runs").insert(rows);

  if (error) {
    throw new Error(`Failed to save provider runs: ${error.message}`);
  }
}
