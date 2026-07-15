export interface ProductMemory {
  productKey: string;
  provider: string;

  firstSeen: string;
  lastSeen: string;

  timesSeen: number;
  timesRecommended: number;
  timesPublished: number;
  timesSold: number;
  timesRetired: number;

  highestAIScore: number;
  lowestAIScore: number;
  averageAIScore: number;

  currentSupplier: string;
  supplierChanges: number;

  currentPrice: number;
  lowestPrice: number;
  highestPrice: number;

  trendHistory: number[];
  confidenceHistory: number[];
  currentConfidence: number;
  decisionHistory: string[];

  notes: string[];

  version: string;
}

export type ProductMemoryEventType =
  | "SEEN"
  | "RECOMMENDED"
  | "PUBLISHED"
  | "SOLD"
  | "RETIRED"
  | "SUPPLIER_CHANGED"
  | "PRICE_CHANGED"
  | "TREND_CHANGED"
  | "CONFIDENCE_CHANGED"
  | "DECISION_CHANGED"
  | "NOTE_ADDED";

export interface ProductMemoryEvent {
  type: ProductMemoryEventType;
  productKey: string;
  productDatabaseId?: string;
  scanId?: string;
  value?: unknown;
  previousValue?: unknown;
  metadata?: Record<string, unknown>;
  occurredAt: string;
}

export interface ProductMemoryUpdateOptions {
  recommended?: boolean;
  published?: boolean;
  soldQuantity?: number;
  retired?: boolean;
  scanId?: string;
  productDatabaseId?: string;
  notes?: string[];
}
