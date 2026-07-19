import { NextResponse } from "next/server";

import { createApiErrorResponse } from "@/auth/apiErrorResponse";
import { requireApiContext } from "@/auth/requireApiContext";
import { getOperationsHealthReport } from "@/operations/health";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const apiContext = await requireApiContext(request, "jobs.read");
    const report = await getOperationsHealthReport(apiContext.tenantContext);

    return NextResponse.json(report);
  } catch (error) {
    return createApiErrorResponse(error);
  }
}
