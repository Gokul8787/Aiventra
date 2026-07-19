import { NextResponse } from "next/server";
import { createApiErrorResponse } from "@/auth/apiErrorResponse";
import {
  AuthorisationError,
  requireApiContext,
  type AuthenticatedApiContext,
} from "@/auth/requireApiContext";
import { writeAuditLog } from "@/security/auditLogger";
import { enqueueSupplierOrderCreationJob } from "@/services/jobs/enqueueSupplierOrderJob";
import { getOrderById } from "@/services/repositories/orderRepository";

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
    apiContext = await requireApiContext(
      request,
      "orders.fulfilment.approve"
    );
    const order = await getOrderById(apiContext.tenantContext, id);

    if (!order) {
      return NextResponse.json(
        {
          success: false,
          message: "Order not found.",
        },
        { status: 404 }
      );
    }

    if (order.status === "cancelled" || order.cancelledAt) {
      throw new AuthorisationError("Cancelled orders cannot be fulfilled.");
    }

    if (order.status === "refunded" || order.refundedAt) {
      throw new AuthorisationError("Refunded orders cannot be fulfilled.");
    }

    const result = await enqueueSupplierOrderCreationJob({
      tenantContext: apiContext.tenantContext,
      orderId: order.id,
      approved: true,
    });

    await writeAuditLog({
      context: apiContext,
      request,
      action: "order.fulfilment_approved",
      resourceType: "order",
      resourceId: order.id,
      outcome: "success",
      metadata: {
        supplierOrderJobId: result.jobId,
      },
    });

    return NextResponse.json(
      {
        success: true,
        orderId: order.id,
        jobId: result.jobId,
        queueMessageId: result.queueMessageId,
        status: result.status,
      },
      { status: 202 }
    );
  } catch (error) {
    await writeAuditLog({
      context: apiContext,
      request,
      action: "order.fulfilment_approved",
      resourceType: "order",
      outcome: error instanceof AuthorisationError ? "denied" : "failure",
      metadata: {
        error: error instanceof Error ? error.message : "Unknown error",
      },
    });

    return createApiErrorResponse(error);
  }
}
