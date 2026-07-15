import { NextResponse } from "next/server";
import { createApiErrorResponse } from "@/auth/apiErrorResponse";
import { requireApiContext } from "@/auth/requireApiContext";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const context = await requireApiContext(request, "dashboard.read");

    return NextResponse.json({
      success: true,
      tenantContext: context.tenantContext,
    });
  } catch (error) {
    return createApiErrorResponse(error);
  }
}
