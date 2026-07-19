import { NextResponse } from "next/server";

import { createApiErrorResponse } from "@/auth/apiErrorResponse";
import { requireApiContext } from "@/auth/requireApiContext";
import { getOperationsDashboard } from "@/operations/dashboardService";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const apiContext = await requireApiContext(request, "jobs.read");
    const dashboard = await getOperationsDashboard(apiContext.tenantContext);

    return NextResponse.json(dashboard);
  } catch (error) {
    return createApiErrorResponse(error);
  }
}
