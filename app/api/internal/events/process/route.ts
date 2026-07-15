import { NextResponse } from "next/server";
import { processEvents } from "@/services/events/processEvents";

function isAuthorized(request: Request) {
  const secret = process.env.EVENT_WORKER_SECRET;

  if (!secret) return true;

  return request.headers.get("x-aiventra-worker-secret") === secret;
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
