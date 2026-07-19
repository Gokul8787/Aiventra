import type { AiventraJobType, JobQueueName } from "@/jobs/types";

export function queueForJobType(jobType: AiventraJobType): JobQueueName {
  return jobType.startsWith("CJ_") ||
    jobType.startsWith("SUPPLIER_ORDER_") ||
    jobType === "SUPPLIER_CANCELLATION"
    ? "aiventra-cj"
    : jobType === "SHOPIFY_FULFILMENT"
      ? "aiventra-shopify"
    : "aiventra-jobs";
}
