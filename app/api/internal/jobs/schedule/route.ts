import { NextResponse } from "next/server";
import { enqueueDueScheduledJobs } from "@/services/jobs/scheduler";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

function isAuthorized(request: Request) {
  const secret = process.env.AIVENTRA_WORKER_SECRET;

  if (!secret) return true;

  return request.headers.get("authorization") === `Bearer ${secret}`;
}

export async function POST(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json(
      {
        success: false,
        message: "Unauthorized.",
      },
      { status: 401 }
    );
  }

  try {
    const body = await request.json().catch(() => ({}));
    const result = await enqueueDueScheduledJobs({
      limit: Number(body.limit || 10),
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
          error instanceof Error ? error.message : "Scheduled job enqueue failed.",
      },
      { status: 500 }
    );
  }
}
