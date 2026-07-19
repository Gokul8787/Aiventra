import type { TenantContext } from "@/context/storeContext";

export type DomainEventType =
  | "ProductScanRequested"
  | "ProductScanned"
  | "RulesEvaluationRequested"
  | "RulesEvaluated"
  | "AutomationActionCreated"
  | "IntelligenceCalculationRequested"
  | "IntelligenceCalculated"
  | "ListingGenerationRequested"
  | "ListingGenerated"
  | "ListingApproved"
  | "ShopifyPublicationRequested"
  | "Published"
  | "ProductWatchScheduled"
  | "OrderReceived"
  | "OrderCancelled"
  | "OrderValidated"
  | "AwaitingSupplier"
  | "SupplierOrderCreated"
  | "TrackingReceived"
  | "FulfilmentRequested"
  | "FulfilmentCreated"
  | "Fulfilled"
  | "Delivered"
  | "Refunded"
  | "RefundRecorded"
  | "OrderCancellationRequested"
  | "CancellationCompleted"
  | "CancellationReviewRequired"
  | "OperationsAlertCreated"
  | "EventFailed";

export interface DomainEvent<TPayload = Record<string, unknown>> {
  id: string;
  tenantContext: TenantContext;
  eventType: DomainEventType;
  aggregateType: string;
  aggregateId: string;
  payload: TPayload;
  metadata: Record<string, unknown>;
  attempts: number;
  maxAttempts: number;
  createdAt: string;
}
