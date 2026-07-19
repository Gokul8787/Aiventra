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
  | "ORDER_CANCELLATION"
  | "SUPPLIER_ORDER_CREATION"
  | "SUPPLIER_CANCELLATION"
  | "SUPPLIER_ORDER_STATUS_SYNC"
  | "SUPPLIER_TRACKING_SYNC"
  | "SHOPIFY_FULFILMENT"
  | "STALE_JOB_RECOVERY"
  | "RECOVERY_RETRY"
  | "DEAD_LETTER_REPLAY";

export type JobType = AiventraJobType;

export type JobQueueName =
  | "aiventra-jobs"
  | "aiventra-cj"
  | "aiventra-shopify"
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
