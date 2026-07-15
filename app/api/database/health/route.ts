import { NextResponse } from "next/server";
import { createApiErrorResponse } from "@/auth/apiErrorResponse";
import { requireApiContext } from "@/auth/requireApiContext";
import { testSupabaseConnection } from "@/services/supabase/health";

export async function GET(request: Request) {
  try {
    await requireApiContext(request, "audit.read");
    const health = await testSupabaseConnection();

    return NextResponse.json({
      success: true,
      database: health,
      checkedAt: new Date().toISOString(),
    });
  } catch (error) {
    return createApiErrorResponse(error);
  }
}
