import { tenantPayload } from "@/context/storeContext";
import type { DomainEvent } from "@/events/types";
import { createQueuedJob, saveQueueMessageId } from "@/services/repositories/backgroundJobRepository";
import { enqueueJobMessage } from "@/services/queues/jobQueue";
import { EventHandler } from "./types";

export const orderCancellationRequestedHandler: EventHandler = {
  name: "order-cancellation-requested-handler",
  eventType: "OrderCancellationRequested",

  async handle(event: DomainEvent): Promise<void> {
    const orderId = String(event.payload.orderId || event.aggregateId);
    const cancellationRequestId = String(event.payload.cancellationRequestId || "");

    if (!orderId || !cancellationRequestId) {
      throw new Error(
        "orderId and cancellationRequestId are required for OrderCancellationRequested."
      );
    }

    const job = await createQueuedJob({
      tenantContext: event.tenantContext,
      jobType: "ORDER_CANCELLATION",
      queueName: "aiventra-jobs",
      payload: {
        orderId,
        cancellationRequestId,
        tenantContext: tenantPayload(event.tenantContext),
      },
      idempotencyKey: [
        event.tenantContext.organisationId,
        event.tenantContext.storeId,
        cancellationRequestId,
        "order-cancellation",
      ].join(":"),
    });

    if (job.queueMessageId) {
      return;
    }

    const queueMessageId = await enqueueJobMessage({
      queueName: "aiventra-jobs",
      jobId: job.id,
      jobType: "ORDER_CANCELLATION",
      organisationId: event.tenantContext.organisationId,
      storeId: event.tenantContext.storeId,
      payload: {
        orderId,
        cancellationRequestId,
        tenantContext: tenantPayload(event.tenantContext),
      },
      correlationId: event.id,
      causationId: event.id,
    });

    await saveQueueMessageId(job.id, queueMessageId);
  },
};
