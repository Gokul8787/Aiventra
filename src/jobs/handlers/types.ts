import type { AiventraJobType, JobMessage, JobQueueName } from "@/jobs/types";

export type JobHandlerResult = {
  rescheduled?: boolean;
  resultReference?: Record<string, unknown>;
  nextJobs?: Array<{
    jobType: AiventraJobType;
    queueName: Exclude<JobQueueName, "aiventra-dead-letter">;
    payload: Record<string, unknown>;
  }>;
};

export interface JobHandler {
  readonly jobType: AiventraJobType;

  handle(input: {
    message: JobMessage;
    workerId: string;
    reportProgress(
      progress: number,
      step: string,
      message?: string
    ): Promise<void>;
  }): Promise<JobHandlerResult>;
}
