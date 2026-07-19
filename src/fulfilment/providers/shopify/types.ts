export type ShopifyTrackingInfo = {
  company?: string | null;
  number?: string | null;
  url?: string | null;
};

export type ShopifyFulfilmentNode = {
  id: string;
  status: string;
  trackingInfo?: ShopifyTrackingInfo[] | null;
};

export type ShopifyFulfilmentOrderNode = {
  id: string;
  status: string;
  requestStatus?: string | null;
  supportedActions?: Array<{ action: string }> | null;
  lineItems: {
    nodes: Array<{
      id: string;
      remainingQuantity: number;
      lineItem?: {
        id: string;
        sku?: string | null;
        quantity?: number | null;
      } | null;
    }>;
  };
  fulfillments?: {
    nodes: ShopifyFulfilmentNode[];
  } | null;
};

export type ShopifyFulfilmentOrdersQuery = {
  order: {
    id: string;
    cancelledAt?: string | null;
    displayFinancialStatus?: string | null;
    displayFulfillmentStatus?: string | null;
    totalRefundedSet?: {
      shopMoney?: {
        amount?: string | null;
      } | null;
    } | null;
    fulfillments?: {
      nodes: ShopifyFulfilmentNode[];
    } | null;
    fulfillmentOrders: {
      nodes: ShopifyFulfilmentOrderNode[];
    };
  } | null;
};

export type ShopifyFulfilmentCreateMutation = {
  fulfillmentCreate: {
    fulfillment: {
      id: string;
      status: string;
      trackingInfo?: ShopifyTrackingInfo[] | null;
    } | null;
    userErrors: Array<{
      field?: string[] | null;
      message: string;
    }>;
  };
};

export type ShopifyFulfilmentTrackingUpdateMutation = {
  fulfillmentTrackingInfoUpdate: {
    fulfillment: {
      id: string;
      status: string;
      trackingInfo?: ShopifyTrackingInfo[] | null;
    } | null;
    userErrors: Array<{
      field?: string[] | null;
      message: string;
    }>;
  };
};

export type ShopifyFulfilmentCancelMutation = {
  fulfillmentCancel: {
    fulfillment?: {
      id: string;
      status: string;
    } | null;
    userErrors: Array<{
      field?: string[] | null;
      message: string;
    }>;
  };
};
