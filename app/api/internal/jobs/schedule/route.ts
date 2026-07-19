import { NextResponse } from "next/server";
import { enqueueDueSupplierOrderStatusJobs } from "@/services/fulfilment/enqueueDueSupplierOrderStatusJobs";
import { enqueueDueTrackingSyncJobs } from "@/services/fulfilment/enqueueDueTrackingSyncJobs";
import { enqueueDueScheduledJobs } from "@/services/jobs/scheduler";
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
    const [scheduledJobs, supplierOrderStatusJobs, supplierTrackingJobs] =
      await Promise.all([
        enqueueDueScheduledJobs({
          limit: Number(body.limit || 10),
        }),
        enqueueDueSupplierOrderStatusJobs({
          limit: Number(body.supplierOrderLimit || body.limit || 10),
        }),
        enqueueDueTrackingSyncJobs({
          limit: Number(body.trackingLimit || body.limit || 10),
        }),
      ]);

    return NextResponse.json({
      success: true,
      scheduledJobs,
      supplierOrderStatusJobs,
      supplierTrackingJobs,
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
