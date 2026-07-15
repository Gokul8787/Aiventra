export type AiventraJobType =
  | "PRODUCT_SCAN"
  | "PRODUCT_ANALYSIS"
  | "EVIDENCE_REFRESH"
  | "LISTING_GENERATION"
  | "SHOPIFY_DRAFT_CREATION"
  | "CJ_PRODUCT_REFRESH"
  | "CJ_SHIPPING_QUOTE"
  | "CJ_INVENTORY_REFRESH"
  | "CJ_ORDER_CREATION"
  | "CJ_TRACKING_SYNC"
  | "ORDER_VALIDATION"
  | "STALE_JOB_RECOVERY";

export type JobType = AiventraJobType;

export type JobQueueName =
  | "aiventra-jobs"
  | "aiventra-cj"
  | "aiventra-dead-letter";

export type JobMessage<
  TPayload extends Record<string, unknown> = Record<string, unknown>,
> = {
  jobId: string;
  jobType: AiventraJobType;

  organisationId: string;
  storeId: string;

  payload: TPayload;

  correlationId: string;
  causationId?: string;

  attempt: number;
  createdAt: string;
};

export type JobProgress = {
  progress: number;
  step: string;
  message?: string;
};
