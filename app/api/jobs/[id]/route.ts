import { NextResponse } from "next/server";
import { createApiErrorResponse } from "@/auth/apiErrorResponse";
import { requireApiContext } from "@/auth/requireApiContext";
import { getBackgroundJob } from "@/services/repositories/backgroundJobRepository";

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
    const job = await getBackgroundJob(apiContext.tenantContext, id);

    if (!job) {
      return NextResponse.json(
        {
          success: false,
          message: "Job not found.",
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      tenantContext: apiContext.tenantContext,
      job,
    });
  } catch (error) {
    return createApiErrorResponse(error);
  }
}
