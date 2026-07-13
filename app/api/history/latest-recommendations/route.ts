import { NextResponse } from "next/server";
import { getLatestSavedRecommendations } from "@/services/repositories/scanHistoryRepository";

export async function GET() {
  try {
    const result = await getLatestSavedRecommendations();

    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message:
          error instanceof Error
            ? error.message
            : "Failed to load saved recommendations.",
      },
      { status: 500 }
    );
  }
}
