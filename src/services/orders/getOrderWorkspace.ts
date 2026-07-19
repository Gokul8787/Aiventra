import "server-only";

import type { TenantContext } from "@/context/storeContext";
import { getCustomerById } from "@/services/repositories/customerRepository";
import {
  listCancellationRequestsForOrder,
} from "@/services/repositories/cancellationRepository";
import { listOperationsAlertsForResource } from "@/services/repositories/operationsAlertRepository";
import {
  getOrderById,
  getOrderEvents,
  getOrderItems,
  getOrderValidations,
} from "@/services/repositories/orderRepository";
import {
  listPlatformFulfilmentEvents,
  listPlatformFulfilmentsForOrder,
} from "@/services/repositories/platformFulfilmentRepository";
import {
  listDeadLetterItemsForCancellationRequests,
  listRecoveryAttemptsForCancellationRequest,
} from "@/services/repositories/recoveryRepository";
import { getFulfilmentChecksForOrder } from "@/services/repositories/supplierFulfilmentRepository";
import {
  getSupplierPaymentApprovalBySupplierOrderId,
  getSupplierOrdersForOrder,
  listSupplierOrderStatusSnapshots,
} from "@/services/repositories/supplierOrderRepository";

export async function getOrderWorkspace(
  tenantContext: TenantContext,
  orderId: string
) {
  const order = await getOrderById(tenantContext, orderId);

  if (!order) return null;

  const [
    items,
    validations,
    events,
    customer,
    fulfilmentChecks,
    supplierOrders,
    platformFulfilments,
    cancellationRequests,
  ] = await Promise.all([
    getOrderItems(tenantContext, order.id),
    getOrderValidations(tenantContext, order.id),
    getOrderEvents(tenantContext, order.id),
    order.customerId
      ? getCustomerById(tenantContext, order.customerId)
      : Promise.resolve(null),
    getFulfilmentChecksForOrder(tenantContext, order.id),
    getSupplierOrdersForOrder(tenantContext, order.id),
    listPlatformFulfilmentsForOrder(tenantContext, order.id),
    listCancellationRequestsForOrder({
      organisationId: tenantContext.organisationId,
      storeId: tenantContext.storeId,
      orderId: order.id,
    }),
  ]);

  const supplierOrderDetails = await Promise.all(
    supplierOrders.map(async (supplierOrder) => ({
      supplierOrder,
      paymentApproval: await getSupplierPaymentApprovalBySupplierOrderId({
        context: tenantContext,
        supplierOrderId: supplierOrder.id,
      }),
      snapshots: await listSupplierOrderStatusSnapshots(
        tenantContext,
        supplierOrder.id
      ),
    }))
  );

  const platformFulfilmentDetails = await Promise.all(
    platformFulfilments.map(async (platformFulfilment) => ({
      platformFulfilment,
      events: await listPlatformFulfilmentEvents({
        tenantContext,
        platformFulfilmentId: platformFulfilment.id,
      }),
    }))
  );

  const recoveryAttemptGroups = await Promise.all(
    cancellationRequests.map(async (cancellationRequest) => ({
      cancellationRequestId: cancellationRequest.id,
      attempts: await listRecoveryAttemptsForCancellationRequest({
        cancellationRequestId: cancellationRequest.id,
      }),
      alerts: await listOperationsAlertsForResource({
        tenantContext,
        resourceType: "cancellation_request",
        resourceId: cancellationRequest.id,
      }),
    }))
  );

  const deadLetterItems = await listDeadLetterItemsForCancellationRequests({
    organisationId: tenantContext.organisationId,
    storeId: tenantContext.storeId,
    cancellationRequestIds: cancellationRequests.map((item) => item.id),
  });

  return {
    order,
    items,
    validations,
    events,
    customer,
    fulfilmentChecks,
    supplierOrders,
    supplierOrderDetails,
    platformFulfilments,
    platformFulfilmentDetails,
    recovery: {
      cancellationRequest: cancellationRequests[0] || null,
      cancellationRequests,
      attempts: recoveryAttemptGroups.flatMap((group) => group.attempts),
      attemptsByRequest: recoveryAttemptGroups,
      deadLetterItems,
      alerts: recoveryAttemptGroups.flatMap((group) => group.alerts),
    },
  };
}

export type OrderWorkspace = NonNullable<
  Awaited<ReturnType<typeof getOrderWorkspace>>
>;
