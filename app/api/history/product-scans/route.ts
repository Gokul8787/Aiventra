import { NextResponse } from "next/server";
import { createApiErrorResponse } from "@/auth/apiErrorResponse";
import { requireApiContext } from "@/auth/requireApiContext";
import { getRecentScans } from "@/services/repositories/scanHistoryRepository";

export async function GET(request: Request) {
  try {
    const context = await requireApiContext(request, "dashboard.read");
    const scans = await getRecentScans(context.tenantContext, 10);

    return NextResponse.json({
      success: true,
      tenantContext: context.tenantContext,
      scans,
    });
  } catch (error) {
    return createApiErrorResponse(error);
  }
}
