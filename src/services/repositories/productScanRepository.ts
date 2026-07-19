import "server-only";
import { supabaseAdmin } from "@/services/supabase/admin";
import type { TenantContext } from "@/context/storeContext";
import { tenantColumns } from "@/context/storeContext";

// Tenant-owned rows include organisation_id and store_id via tenantColumns.

type ProductScanRow = {
  id: string;
};

export async function createProductScan(input: {
  tenantContext: TenantContext;
  jobId: string;
  searchQuery?: string;
  recommendationThreshold: number;
}): Promise<string> {
  const { data, error } = await supabaseAdmin
    .from("product_scans")
    .insert({
      ...tenantColumns(input.tenantContext),
      job_id: input.jobId,
      status: "running",
      search_query: input.searchQuery || null,
      recommendation_threshold: input.recommendationThreshold,
      started_at: new Date().toISOString(),
    })
    .select("id")
    .single<ProductScanRow>();

  if (error || !data) {
    throw new Error(
      `Failed to create product scan: ${error?.message || "No row returned"}`
    );
  }

  return data.id;
}

export async function completeProductScan(
  scanId: string,
  totals: {
    totalFound: number;
    totalRecommended: number;
  }
): Promise<void> {
  const { error } = await supabaseAdmin
    .from("product_scans")
    .update({
      status: "completed",
      total_found: totals.totalFound,
      total_recommended: totals.totalRecommended,
      completed_at: new Date().toISOString(),
    })
    .eq("id", scanId);

  if (error) {
    throw new Error(`Failed to complete product scan: ${error.message}`);
  }
}

export async function failProductScan(
  scanId: string,
  errorMessage: string
): Promise<void> {
  const { error } = await supabaseAdmin
    .from("product_scans")
    .update({
      status: "failed",
      error_message: errorMessage,
      completed_at: new Date().toISOString(),
    })
    .eq("id", scanId);

  if (error) {
    console.error("Failed to mark product scan as failed:", error.message);
  }
}
