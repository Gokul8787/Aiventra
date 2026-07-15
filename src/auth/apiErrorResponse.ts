import { NextResponse } from "next/server";

import {
  AuthenticationError,
  AuthorisationError,
} from "./requireApiContext";
import { RateLimitError } from "@/security/rateLimiter";

export function createApiErrorResponse(error: unknown) {
  if (error instanceof AuthenticationError) {
    return NextResponse.json(
      {
        success: false,
        message: error.message,
      },
      { status: 401 }
    );
  }

  if (error instanceof AuthorisationError) {
    return NextResponse.json(
      {
        success: false,
        message: error.message,
      },
      { status: 403 }
    );
  }

  if (error instanceof RateLimitError) {
    return NextResponse.json(
      {
        success: false,
        message: error.message,
        resetAt: error.resetAt,
      },
      {
        status: 429,
        headers: {
          "Retry-After": String(
            Math.max(
              1,
              Math.ceil((new Date(error.resetAt).getTime() - Date.now()) / 1000)
            )
          ),
        },
      }
    );
  }

  return NextResponse.json(
    {
      success: false,
      message:
        error instanceof Error ? error.message : "Unexpected server error.",
    },
    { status: 500 }
  );
}
