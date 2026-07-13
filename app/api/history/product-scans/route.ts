import { NextResponse } from "next/server";
import { getRecentScans } from "@/services/repositories/scanHistoryRepository";

export async function GET() {
  try {
    const scans = await getRecentScans(10);

    return NextResponse.json({
      success: true,
      scans,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message:
          error instanceof Error
            ? error.message
            : "Failed to load scan history.",
      },
      { status: 500 }
    );
  }
}
