import { NextResponse } from "next/server";
import { createApiErrorResponse } from "@/auth/apiErrorResponse";
import {
  requireApiContext,
  type AuthenticatedApiContext,
} from "@/auth/requireApiContext";
import { ORDER_EVENTS } from "@/orders/events";
import { writeAuditLog } from "@/security/auditLogger";
import { publishEvent } from "@/services/events/eventRepository";
import { getOrderById } from "@/services/repositories/orderRepository";
import { createCancellationRequest } from "@/services/repositories/cancellationRepository";

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
    apiContext = await requireApiContext(request, "orders.fulfilment.approve");
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

    const body = await request.json().catch(() => ({}));
    const cancellationRequest = await createCancellationRequest({
      organisationId: apiContext.tenantContext.organisationId,
      storeId: apiContext.tenantContext.storeId,
      orderId: order.id,
      source: "operator",
      reason:
        typeof body.reason === "string" && body.reason.trim()
          ? body.reason.trim()
          : "Operator requested cancellation recovery.",
      requestedBy: apiContext.user.id,
      metadata:
        body.metadata && typeof body.metadata === "object"
          ? (body.metadata as Record<string, unknown>)
          : {},
    });

    const eventId = await publishEvent({
      tenantContext: apiContext.tenantContext,
      eventType: ORDER_EVENTS.cancellationRequested,
      aggregateType: "order",
      aggregateId: order.id,
      payload: {
        orderId: order.id,
        cancellationRequestId: cancellationRequest.id,
        source: cancellationRequest.source,
        reason: cancellationRequest.reason,
      },
    });

    await writeAuditLog({
      context: apiContext,
      request,
      action: "order.recovery_requested",
      resourceType: "cancellation_request",
      resourceId: cancellationRequest.id,
      outcome: "success",
      metadata: {
        orderId: order.id,
        eventId,
      },
    });

    return NextResponse.json(
      {
        success: true,
        orderId: order.id,
        cancellationRequestId: cancellationRequest.id,
        status: cancellationRequest.status,
        eventId,
      },
      { status: 202 }
    );
  } catch (error) {
    await writeAuditLog({
      context: apiContext,
      request,
      action: "order.recovery_requested",
      resourceType: "cancellation_request",
      outcome: "failure",
      metadata: {
        error: error instanceof Error ? error.message : "Unknown error",
      },
    });

    return createApiErrorResponse(error);
  }
}
