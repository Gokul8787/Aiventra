import { NextResponse } from "next/server";

import { createApiErrorResponse } from "@/auth/apiErrorResponse";
import {
  requireApiContext,
  type AuthenticatedApiContext,
} from "@/auth/requireApiContext";
import { writeAuditLog } from "@/security/auditLogger";
import {
  getDeadLetterItemById,
  updateDeadLetterItemStatus,
} from "@/services/repositories/recoveryRepository";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function POST(request: Request, context: RouteContext) {
  let apiContext: AuthenticatedApiContext | undefined;

  try {
    const { id } = await context.params;
    apiContext = await requireApiContext(request, "jobs.manage");
    const item = await getDeadLetterItemById({
      organisationId: apiContext.tenantContext.organisationId,
      storeId: apiContext.tenantContext.storeId,
      deadLetterItemId: id,
    });

    if (!item) {
      return NextResponse.json(
        {
          success: false,
          message: "Dead-letter item not found.",
        },
        { status: 404 }
      );
    }

    await updateDeadLetterItemStatus({
      deadLetterItemId: item.id,
      status: "ignored",
      organisationId: apiContext.tenantContext.organisationId,
      storeId: apiContext.tenantContext.storeId,
    });

    await writeAuditLog({
      context: apiContext,
      request,
      action: "operations.dead_letter_ignored",
      resourceType: "dead_letter_item",
      resourceId: item.id,
      outcome: "success",
    });

    return NextResponse.json({
      success: true,
      deadLetterItemId: item.id,
      status: "ignored",
    });
  } catch (error) {
    await writeAuditLog({
      context: apiContext,
      request,
      action: "operations.dead_letter_ignored",
      resourceType: "dead_letter_item",
      outcome: "failure",
      metadata: {
        error: error instanceof Error ? error.message : "Unknown error",
      },
    });

    return createApiErrorResponse(error);
  }
}
