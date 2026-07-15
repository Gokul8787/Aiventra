import type { AiventraJobType, JobQueueName } from "@/jobs/types";

export function queueForJobType(jobType: AiventraJobType): JobQueueName {
  return jobType.startsWith("CJ_") ? "aiventra-cj" : "aiventra-jobs";
}
