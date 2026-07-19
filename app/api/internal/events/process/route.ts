import { NextResponse } from "next/server";
import { processEvents } from "@/services/events/processEvents";
import {
  WorkerAuthenticationError,
  requireWorkerSecret,
} from "@/security/requireWorkerSecret";

export async function POST(request: Request) {
  try {
    requireWorkerSecret(request, "EVENT_WORKER_SECRET");
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
    const result = await processEvents({
      limit: 10,
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
          error instanceof Error ? error.message : "Event processing failed.",
      },
      { status: 500 }
    );
  }
}
