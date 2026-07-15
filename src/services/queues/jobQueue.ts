import "server-only";

import type {
  AiventraJobType,
  JobMessage,
  JobQueueName,
} from "@/jobs/types";
import { supabaseAdmin } from "@/services/supabase/admin";

type QueueMessageRow = {
  msg_id: number | string;
  message: JobMessage;
};

export type QueuedJobMessage = {
  messageId: number;
  message: JobMessage;
};

export async function enqueueJobMessage(input: {
  queueName: JobQueueName;
  jobId: string;
  jobType: AiventraJobType;
  organisationId: string;
  storeId: string;
  payload?: Record<string, unknown>;
  correlationId?: string;
  causationId?: string;
  attempt?: number;
  delaySeconds?: number;
}): Promise<number> {
  const message: JobMessage = {
    jobId: input.jobId,
    jobType: input.jobType,
    organisationId: input.organisationId,
    storeId: input.storeId,
    payload: input.payload || {},
    correlationId: input.correlationId || crypto.randomUUID(),
    causationId: input.causationId,
    attempt: input.attempt || 1,
    createdAt: new Date().toISOString(),
  };

  const { data, error } = await supabaseAdmin.schema("pgmq_public").rpc(
    "send",
    {
      queue_name: input.queueName,
      message,
      sleep_seconds: input.delaySeconds || 0,
    }
  );

  if (error) {
    throw new Error(`Failed to enqueue ${input.jobType}: ${error.message}`);
  }

  return Number(data);
}

export async function readJobMessages(input: {
  queueName: JobQueueName;
  limit?: number;
  visibilityTimeoutSeconds?: number;
}): Promise<QueuedJobMessage[]> {
  const { data, error } = await supabaseAdmin.schema("pgmq_public").rpc(
    "read",
    {
      queue_name: input.queueName,
      sleep_seconds: input.visibilityTimeoutSeconds || 300,
      n: input.limit || 1,
    }
  );

  if (error) {
    throw new Error(`Failed to read ${input.queueName}: ${error.message}`);
  }

  return ((data || []) as QueueMessageRow[]).map((row) => ({
    messageId: Number(row.msg_id),
    message: row.message,
  }));
}

export async function archiveQueueMessage(input: {
  queueName: JobQueueName;
  messageId: number;
}): Promise<void> {
  const { error } = await supabaseAdmin.schema("pgmq_public").rpc("archive", {
    queue_name: input.queueName,
    message_id: input.messageId,
  });

  if (error) {
    throw new Error(`Failed to archive queue message: ${error.message}`);
  }
}

export async function deleteQueueMessage(input: {
  queueName: JobQueueName;
  messageId: number;
}): Promise<void> {
  const { error } = await supabaseAdmin.schema("pgmq_public").rpc("delete", {
    queue_name: input.queueName,
    message_id: input.messageId,
  });

  if (error) {
    throw new Error(`Failed to delete queue message: ${error.message}`);
  }
}

export async function moveToDeadLetter(
  message: JobMessage,
  errorMessage: string
): Promise<number> {
  return enqueueJobMessage({
    queueName: "aiventra-dead-letter",
    jobId: message.jobId,
    jobType: message.jobType,
    organisationId: message.organisationId,
    storeId: message.storeId,
    payload: {
      ...message.payload,
      errorMessage,
      failedAt: new Date().toISOString(),
    },
    correlationId: message.correlationId,
    causationId: message.causationId,
    attempt: message.attempt,
  });
}
