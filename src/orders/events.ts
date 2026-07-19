export const ORDER_EVENTS = {
  received: "OrderReceived",
  cancelled: "OrderCancelled",
  validated: "OrderValidated",
  awaitingSupplier: "AwaitingSupplier",
  supplierOrderCreated: "SupplierOrderCreated",
  trackingReceived: "TrackingReceived",
  fulfilled: "Fulfilled",
  delivered: "Delivered",
  refunded: "Refunded",
  refundRecorded: "RefundRecorded",
  cancellationRequested: "OrderCancellationRequested",
  cancellationCompleted: "CancellationCompleted",
  cancellationReviewRequired: "CancellationReviewRequired",
  operationsAlertCreated: "OperationsAlertCreated",
} as const;

export type OrderCommerceEvent =
  (typeof ORDER_EVENTS)[keyof typeof ORDER_EVENTS];
