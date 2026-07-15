import { NextResponse } from "next/server";
import { createApiErrorResponse } from "@/auth/apiErrorResponse";
import { requireApiContext } from "@/auth/requireApiContext";
import { getLatestActiveJob } from "@/services/repositories/backgroundJobRepository";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const context = await requireApiContext(request, "jobs.read");
    const job = await getLatestActiveJob(context.tenantContext);

    return NextResponse.json({
      success: true,
      tenantContext: context.tenantContext,
      job,
    });
  } catch (error) {
    return createApiErrorResponse(error);
  }
}
