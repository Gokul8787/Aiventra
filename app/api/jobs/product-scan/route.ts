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
import {
  getProductScanSearchLabel,
  ProductScanRequestSchema,
} from "@/services/productDiscovery/productScanRequest";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  let context: AuthenticatedApiContext | undefined;

  try {
    const body = await request.json().catch(() => ({}));
    const parsedScanRequest = ProductScanRequestSchema.safeParse(body);

    if (!parsedScanRequest.success) {
      return NextResponse.json(
        {
          success: false,
          message: "Invalid product scan request.",
          errors: parsedScanRequest.error.flatten(),
        },
        { status: 400 }
      );
    }

    context = await requireApiContext(request, "product_scan.run");

    await enforceRateLimit(`user:${context.user.id}`, {
      route: "product-hunter-scan",
      maximumRequests: 10,
      windowSeconds: 3600,
    });

    const result = await enqueueProductScanJob({
      tenantContext: context.tenantContext,
      request: parsedScanRequest.data,
      searchQuery: getProductScanSearchLabel(parsedScanRequest.data),
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
        request: parsedScanRequest.data,
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
