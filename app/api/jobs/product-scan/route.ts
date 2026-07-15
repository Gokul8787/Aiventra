import { NextResponse } from "next/server";
import { createApiErrorResponse } from "@/auth/apiErrorResponse";
import {
  AuthorisationError,
  requireApiContext,
  type AuthenticatedApiContext,
} from "@/auth/requireApiContext";
import { enforceRateLimit } from "@/security/rateLimiter";
import { writeAuditLog } from "@/security/auditLogger";
import { enqueueProductScanJob } from "@/services/jobs/enqueueProductScanJob";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  let context: AuthenticatedApiContext | undefined;

  try {
    const body = await request.json().catch(() => ({}));
    context = await requireApiContext(request, "product_scan.run");

    await enforceRateLimit(`user:${context.user.id}`, {
      route: "product-hunter-scan",
      maximumRequests: 10,
      windowSeconds: 3600,
    });

    const result = await enqueueProductScanJob({
      tenantContext: context.tenantContext,
      searchQuery: String(body.searchQuery || "pet"),
      generateInsights:
        typeof body.generateInsights === "boolean"
          ? body.generateInsights
          : true,
    });

    await writeAuditLog({
      context,
      request,
      action: "product_scan.queued",
      resourceType: "ai_job",
      resourceId: result.jobId,
      outcome: "success",
    });

    return NextResponse.json(
      {
        success: true,
        jobId: result.jobId,
        queueMessageId: result.queueMessageId,
        status: result.status,
        tenantContext: context.tenantContext,
      },
      { status: 202 }
    );
  } catch (error) {
    await writeAuditLog({
      context,
      request,
      action: "product_scan.queued",
      resourceType: "ai_job",
      outcome: error instanceof AuthorisationError ? "denied" : "failure",
      metadata: {
        error: error instanceof Error ? error.message : "Unknown error",
      },
    });

    return createApiErrorResponse(error);
  }
}
