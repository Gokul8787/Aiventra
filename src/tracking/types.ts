export type ShipmentTrackingStatus =
  | "pending"
  | "tracking_pending"
  | "in_transit"
  | "out_for_delivery"
  | "delivered"
  | "exception"
  | "returned"
  | "cancelled"
  | "unknown";

export type TrackingEventStatus =
  | "pending"
  | "label_created"
  | "shipped"
  | "in_transit"
  | "out_for_delivery"
  | "delivered"
  | "exception"
  | "returned"
  | "cancelled"
  | "unknown";

export type FulfilmentUpdateStatus =
  | "pending"
  | "submitted"
  | "success"
  | "failed";

export type DeliveryEventType =
  | "TRACKING_RECEIVED"
  | "SHIPPED"
  | "OUT_FOR_DELIVERY"
  | "DELIVERED"
  | "EXCEPTION"
  | "RETURNED"
  | "CANCELLED";

export type ShipmentTracking = {
  id: string;
  organisationId: string;
  storeId: string;
  orderId: string;
  supplierOrderId?: string;
  provider: string;
  trackingKey: string;
  status: ShipmentTrackingStatus;
  trackingNumber?: string;
  courier?: string;
  trackingUrl?: string;
  shippedAt?: string;
  deliveredAt?: string;
  lastSyncAt?: string;
  lastEventAt?: string;
  lastEventSummary?: string;
  rawData: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

export type TrackingEvent = {
  id: string;
  organisationId: string;
  storeId: string;
  shipmentTrackingId: string;
  provider: string;
  dedupeKey: string;
  externalEventId?: string;
  eventCode?: string;
  status: TrackingEventStatus;
  summary: string;
  details?: string;
  location?: string;
  occurredAt: string;
  rawData: Record<string, unknown>;
  createdAt: string;
};

export type FulfilmentUpdate = {
  id: string;
  organisationId: string;
  storeId: string;
  orderId: string;
  shipmentTrackingId?: string;
  provider: string;
  dedupeKey: string;
  externalFulfilmentId?: string;
  status: FulfilmentUpdateStatus;
  requestPayload: Record<string, unknown>;
  responsePayload: Record<string, unknown>;
  errorMessage?: string;
  processedAt?: string;
  createdAt: string;
};

export type DeliveryEvent = {
  id: string;
  organisationId: string;
  storeId: string;
  orderId: string;
  shipmentTrackingId: string;
  dedupeKey: string;
  eventType: DeliveryEventType;
  status?: string;
  message?: string;
  occurredAt: string;
  rawData: Record<string, unknown>;
  createdAt: string;
};

export type ShipmentTrackingInput = {
  orderId: string;
  supplierOrderId?: string;
  provider: string;
  trackingNumber?: string;
  courier?: string;
  trackingUrl?: string;
  status: ShipmentTrackingStatus;
  shippedAt?: string;
  deliveredAt?: string;
  lastSyncAt?: string;
  lastEventAt?: string;
  lastEventSummary?: string;
  rawData?: Record<string, unknown>;
};

export type TrackingEventInput = {
  shipmentTrackingId: string;
  provider: string;
  externalEventId?: string;
  eventCode?: string;
  status: TrackingEventStatus;
  summary: string;
  details?: string;
  location?: string;
  occurredAt: string;
  rawData?: Record<string, unknown>;
};

export type FulfilmentUpdateInput = {
  orderId: string;
  shipmentTrackingId?: string;
  provider: string;
  externalFulfilmentId?: string;
  status: FulfilmentUpdateStatus;
  requestPayload?: Record<string, unknown>;
  responsePayload?: Record<string, unknown>;
  errorMessage?: string;
  processedAt?: string;
};

export type DeliveryEventInput = {
  orderId: string;
  shipmentTrackingId: string;
  eventType: DeliveryEventType;
  status?: string;
  message?: string;
  occurredAt: string;
  rawData?: Record<string, unknown>;
};
