import { NextResponse } from "next/server";
import { createApiErrorResponse } from "@/auth/apiErrorResponse";
import { requireApiContext } from "@/auth/requireApiContext";
import { getJobLogs } from "@/services/repositories/backgroundJobRepository";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function GET(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const apiContext = await requireApiContext(request, "jobs.read");
    const logs = await getJobLogs(apiContext.tenantContext, id);

    return NextResponse.json({
      success: true,
      tenantContext: apiContext.tenantContext,
      logs,
    });
  } catch (error) {
    return createApiErrorResponse(error);
  }
}
