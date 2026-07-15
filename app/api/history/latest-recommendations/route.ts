import { NextResponse } from "next/server";
import { createApiErrorResponse } from "@/auth/apiErrorResponse";
import { requireApiContext } from "@/auth/requireApiContext";
import { getLatestSavedRecommendations } from "@/services/repositories/scanHistoryRepository";

export async function GET(request: Request) {
  try {
    const context = await requireApiContext(request, "dashboard.read");
    const result = await getLatestSavedRecommendations(context.tenantContext);

    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (error) {
    return createApiErrorResponse(error);
  }
}
