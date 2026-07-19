import "server-only";
import { supabaseAdmin } from "@/services/supabase/admin";
import { SourceStatus } from "@/ai/agents/trendCollector";
import type { TenantContext } from "@/context/storeContext";
import { tenantColumns } from "@/context/storeContext";

export async function saveProviderRuns(
  tenantContext: TenantContext,
  scanId: string,
  sources: SourceStatus[]
): Promise<void> {
  if (sources.length === 0) return;

  const now = new Date().toISOString();

  const rows = sources.map((source) => ({
    ...tenantColumns(tenantContext),
    scan_id: scanId,
    provider_name: source.name,
    status: source.status,
    products_found: source.count,
    error_message: source.error || null,
    metadata: source.metadata || {},
    started_at: now,
    completed_at: now,
  }));

  const { error } = await supabaseAdmin.from("provider_runs").insert(rows);

  if (error) {
    throw new Error(`Failed to save provider runs: ${error.message}`);
  }
}
