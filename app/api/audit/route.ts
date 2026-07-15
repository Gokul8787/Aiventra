import { NextResponse } from "next/server";

import { createApiErrorResponse } from "@/auth/apiErrorResponse";
import { requireApiContext } from "@/auth/requireApiContext";
import { supabaseAdmin } from "@/services/supabase/admin";

export async function GET(request: Request) {
  try {
    const context = await requireApiContext(request, "audit.read");
    const url = new URL(request.url);
    const limit = Math.min(
      Math.max(Number(url.searchParams.get("limit") || 50), 1),
      200
    );

    const { data, error } = await supabaseAdmin
      .from("audit_logs")
      .select("*")
      .eq("organisation_id", context.tenantContext.organisationId)
      .eq("store_id", context.tenantContext.storeId)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) {
      throw new Error(`Failed to load audit logs: ${error.message}`);
    }

    return NextResponse.json({
      success: true,
      logs: data || [],
    });
  } catch (error) {
    return createApiErrorResponse(error);
  }
}
