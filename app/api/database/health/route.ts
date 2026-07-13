import { NextResponse } from "next/server";
import { testSupabaseConnection } from "@/services/supabase/health";

export async function GET() {
  try {
    const health = await testSupabaseConnection();

    return NextResponse.json({
      success: true,
      database: health,
      checkedAt: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message:
          error instanceof Error
            ? error.message
            : "Supabase health check failed.",
      },
      { status: 500 }
    );
  }
}
