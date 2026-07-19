import { NextResponse } from "next/server";
import { createApiErrorResponse } from "@/auth/apiErrorResponse";
import {
  AuthorisationError,
  requireApiContext,
  type AuthenticatedApiContext,
} from "@/auth/requireApiContext";
import { writeAuditLog } from "@/security/auditLogger";
import { getOrderById } from "@/services/repositories/orderRepository";
import {
  approveSupplierPaymentApproval,
  getSupplierOrderByOrderId,
  getSupplierPaymentApprovalBySupplierOrderId,
} from "@/services/repositories/supplierOrderRepository";

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
      throw new AuthorisationError("Cancelled orders cannot be approved.");
    }

    if (order.status === "refunded" || order.refundedAt) {
      throw new AuthorisationError("Refunded orders cannot be approved.");
    }

    const supplierOrder = await getSupplierOrderByOrderId(
      apiContext.tenantContext,
      order.id
    );

    if (!supplierOrder) {
      return NextResponse.json(
        {
          success: false,
          message: "Supplier order not found.",
        },
        { status: 404 }
      );
    }

    const approval = await getSupplierPaymentApprovalBySupplierOrderId({
      context: apiContext.tenantContext,
      supplierOrderId: supplierOrder.id,
    });

    if (!approval) {
      return NextResponse.json(
        {
          success: false,
          message: "Supplier payment approval is not pending.",
        },
        { status: 400 }
      );
    }

    if (approval.status !== "pending") {
      return NextResponse.json(
        {
          success: false,
          message: `Supplier payment approval is already ${approval.status}.`,
        },
        { status: 409 }
      );
    }

    const approved = await approveSupplierPaymentApproval({
      context: apiContext.tenantContext,
      supplierOrderId: supplierOrder.id,
      approvedBy: apiContext.user.id,
    });

    await writeAuditLog({
      context: apiContext,
      request,
      action: "supplier_payment.approved",
      resourceType: "supplier_order",
      resourceId: supplierOrder.id,
      outcome: "success",
      metadata: {
        orderId: order.id,
        supplierOrderId: supplierOrder.id,
        amount: approved.requestedAmount,
        currency: approved.currency,
        approvedBy: approved.approvedBy,
        approvedAt: approved.approvedAt,
      },
    });

    return NextResponse.json({
      success: true,
      orderId: order.id,
      supplierOrderId: supplierOrder.id,
      approval: approved,
    });
  } catch (error) {
    await writeAuditLog({
      context: apiContext,
      request,
      action: "supplier_payment.approved",
      resourceType: "supplier_order",
      outcome: error instanceof AuthorisationError ? "denied" : "failure",
      metadata: {
        error: error instanceof Error ? error.message : "Unknown error",
      },
    });

    return createApiErrorResponse(error);
  }
}
