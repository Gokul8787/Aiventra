import { NextResponse } from "next/server";
import { createApiErrorResponse } from "@/auth/apiErrorResponse";
import {
  requireApiContext,
  type AuthenticatedApiContext,
} from "@/auth/requireApiContext";
import { tenantPayload } from "@/context/storeContext";
import type { JobQueueName } from "@/jobs/types";
import { writeAuditLog } from "@/security/auditLogger";
import { enqueueJobMessage } from "@/services/queues/jobQueue";
import {
  appendJobLog,
  createQueuedJob,
  saveQueueMessageId,
} from "@/services/repositories/backgroundJobRepository";
import { getDeadLetterItemById } from "@/services/repositories/recoveryRepository";

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
    const deadLetterItem = await getDeadLetterItemById({
      organisationId: apiContext.tenantContext.organisationId,
      storeId: apiContext.tenantContext.storeId,
      deadLetterItemId: id,
    });

    if (!deadLetterItem) {
      return NextResponse.json(
        {
          success: false,
          message: "Dead-letter item not found.",
        },
        { status: 404 }
      );
    }

    const queueName = deadLetterItem.sourceQueue as JobQueueName;
    const job = await createQueuedJob({
      tenantContext: apiContext.tenantContext,
      jobType: "DEAD_LETTER_REPLAY",
      queueName,
      payload: {
        deadLetterItemId: deadLetterItem.id,
        tenantContext: tenantPayload(apiContext.tenantContext),
      },
      idempotencyKey: [
        apiContext.tenantContext.organisationId,
        apiContext.tenantContext.storeId,
        deadLetterItem.id,
        "dead-letter-replay",
      ].join(":"),
    });

    let queueMessageId = job.queueMessageId;

    if (!queueMessageId) {
      queueMessageId = await enqueueJobMessage({
        queueName,
        jobId: job.id,
        jobType: "DEAD_LETTER_REPLAY",
        organisationId: apiContext.tenantContext.organisationId,
        storeId: apiContext.tenantContext.storeId,
        payload: {
          deadLetterItemId: deadLetterItem.id,
          tenantContext: tenantPayload(apiContext.tenantContext),
        },
      });

      await saveQueueMessageId(job.id, queueMessageId);

      await appendJobLog({
        tenantContext: apiContext.tenantContext,
        jobId: job.id,
        level: "info",
        step: "Queued",
        message: "Dead-letter replay queued by operations.",
        context: {
          deadLetterItemId: deadLetterItem.id,
          sourceQueue: queueName,
          queueMessageId,
        },
      });
    }

    await writeAuditLog({
      context: apiContext,
      request,
      action: "operations.dead_letter_replay_requested",
      resourceType: "dead_letter_item",
      resourceId: deadLetterItem.id,
      outcome: "success",
      metadata: {
        jobId: job.id,
        queueName,
      },
    });

    return NextResponse.json(
      {
        success: true,
        deadLetterItemId: deadLetterItem.id,
        jobId: job.id,
        queueName,
        queueMessageId,
        status: job.status,
      },
      { status: 202 }
    );
  } catch (error) {
    await writeAuditLog({
      context: apiContext,
      request,
      action: "operations.dead_letter_replay_requested",
      resourceType: "dead_letter_item",
      outcome: "failure",
      metadata: {
        error: error instanceof Error ? error.message : "Unknown error",
      },
    });

    return createApiErrorResponse(error);
  }
}
