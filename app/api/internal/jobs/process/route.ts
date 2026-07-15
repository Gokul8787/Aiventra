import { NextResponse } from "next/server";
import type { JobQueueName } from "@/jobs/types";
import { processJobQueue } from "@/jobs/processJobQueue";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

function getQueueName(value: unknown): JobQueueName {
  if (
    value === "aiventra-jobs" ||
    value === "aiventra-cj" ||
    value === "aiventra-dead-letter"
  ) {
    return value;
  }

  return "aiventra-jobs";
}

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
    const queueName = getQueueName(body.queueName);
    const result = await processJobQueue({
      queueName,
      limit: Number(body.limit || (queueName === "aiventra-cj" ? 1 : 3)),
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
          error instanceof Error ? error.message : "Job processing failed.",
      },
      { status: 500 }
    );
  }
}
