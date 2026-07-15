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
} as const;

export type OrderCommerceEvent =
  (typeof ORDER_EVENTS)[keyof typeof ORDER_EVENTS];
