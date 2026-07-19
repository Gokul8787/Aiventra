import { NextResponse } from "next/server";
import { recoverStaleJobs } from "@/services/jobs/recoverStaleJobs";
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
    const result = await recoverStaleJobs({
      olderThanMinutes: Number(body.olderThanMinutes || 10),
      limit: Number(body.limit || 25),
    });

    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message:
          error instanceof Error ? error.message : "Stale job recovery failed.",
      },
      { status: 500 }
    );
  }
}
