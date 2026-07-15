export type ProductLifecycleStage =
  | "DISCOVERED"
  | "ANALYSED"
  | "AI_APPROVED"
  | "LISTING_GENERATED"
  | "DRAFT_CREATED"
  | "PUBLISHED"
  | "ADVERTISING"
  | "SELLING"
  | "SCALING"
  | "RETIRED";

export type ProductLifecycleStatus =
  | "ACTIVE"
  | "PAUSED"
  | "FAILED"
  | "COMPLETED";

export const PRODUCT_LIFECYCLE_LABELS: Record<ProductLifecycleStage, string> = {
  DISCOVERED: "Discovered",
  ANALYSED: "Analysed",
  AI_APPROVED: "AI Approved",
  LISTING_GENERATED: "Listing Generated",
  DRAFT_CREATED: "Draft Created",
  PUBLISHED: "Published",
  ADVERTISING: "Advertising",
  SELLING: "Selling",
  SCALING: "Scaling",
  RETIRED: "Retired",
};
