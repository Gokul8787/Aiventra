import { NextResponse } from "next/server";
import { recordWorkerHeartbeat } from "@/jobs/heartbeat/workerHeartbeat";
import type { JobQueueName } from "@/jobs/types";
import { processJobQueue } from "@/jobs/processJobQueue";
import {
  WorkerAuthenticationError,
  requireWorkerSecret,
} from "@/security/requireWorkerSecret";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

function getQueueName(value: unknown): JobQueueName {
  if (
    value === "aiventra-jobs" ||
    value === "aiventra-cj" ||
    value === "aiventra-shopify" ||
    value === "aiventra-dead-letter"
  ) {
    return value;
  }

  return "aiventra-jobs";
}

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
    const queueName = getQueueName(body.queueName);
    const workerId =
      typeof body.workerId === "string" && body.workerId.trim()
        ? body.workerId.trim()
        : `${queueName}:${process.pid}`;
    const limit = Number(
      body.limit ||
        (queueName === "aiventra-cj" || queueName === "aiventra-shopify"
          ? 1
          : 3)
    );

    await recordWorkerHeartbeat({
      workerId,
      queueName,
      metadata: {
        phase: "starting",
        limit,
      },
    });

    const result = await processJobQueue({
      queueName,
      limit,
    });

    await recordWorkerHeartbeat({
      workerId,
      queueName,
      metadata: {
        phase: "idle",
        limit,
        processed: result.processed,
        queueName: result.queueName,
      },
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
