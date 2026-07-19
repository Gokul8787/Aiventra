import { NextResponse } from "next/server";
import { processAutomationActions } from "@/services/automation/processAutomationActions";
import {
  WorkerAuthenticationError,
  requireWorkerSecret,
} from "@/security/requireWorkerSecret";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(request: Request) {
  try {
    requireWorkerSecret(request);
  } catch (error) {
    if (error instanceof WorkerAuthenticationError) {
      return NextResponse.json(
        {
          success: false,
          message: error.message,
        },
        { status: error.status }
      );
    }

    return NextResponse.json(
      {
        success: false,
        message:
          error instanceof Error ? error.message : "Worker authentication failed.",
      },
      { status: 500 }
    );
  }

  try {
    const body = await request.json().catch(() => ({}));
    const results = await processAutomationActions(Number(body.limit || 10));

    return NextResponse.json({
      success: true,
      processed: results.length,
      results,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message:
          error instanceof Error
            ? error.message
            : "Automation action processing failed.",
      },
      { status: 500 }
    );
  }
}
