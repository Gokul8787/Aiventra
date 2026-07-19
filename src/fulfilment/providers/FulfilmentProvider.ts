import type { TenantContext } from "@/context/storeContext";
import type { CommerceOrder, CommerceOrderItem } from "@/orders/types";
import type { ShipmentTracking } from "@/tracking/types";

export type FulfilmentLookupInput = {
  tenantContext: TenantContext;
  order: CommerceOrder;
  items: CommerceOrderItem[];
  shipment: ShipmentTracking;
};

export type PlatformFulfilmentLineItem = {
  orderItemId: string;
  platformLineItemId: string;
  fulfilmentOrderId: string;
  fulfilmentOrderLineItemId: string;
  quantity: number;
};

export type FulfilmentOrder = {
  id: string;
  status: string;
  requestStatus?: string;
  supportedActions: string[];
  lineItems: Array<{
    id: string;
    lineItemId?: string;
    remainingQuantity: number;
    quantity?: number;
    sku?: string;
  }>;
  existingFulfilments: Array<{
    id: string;
    status: string;
    trackingNumbers: string[];
    trackingUrls: string[];
    carrier?: string;
  }>;
};

export type CreateFulfilmentInput = FulfilmentLookupInput & {
  notifyCustomer: boolean;
  lineItems: PlatformFulfilmentLineItem[];
};

export type CreateFulfilmentResult = {
  success: boolean;
  externalFulfilmentId?: string;
  externalOrderId?: string;
  externalFulfilmentOrderIds: string[];
  trackingNumber?: string;
  trackingUrl?: string;
  carrier?: string;
  status: string;
  customerNotified: boolean;
  message?: string;
  raw?: Record<string, unknown>;
};

export type UpdateTrackingInput = {
  tenantContext: TenantContext;
  externalFulfilmentId: string;
  trackingNumber: string;
  trackingUrl?: string;
  carrier?: string;
  notifyCustomer: boolean;
};

export type CancelFulfilmentInput = {
  tenantContext: TenantContext;
  externalFulfilmentId: string;
};

export interface FulfilmentProvider {
  readonly id: string;
  readonly name: string;

  getFulfilmentOrders(input: FulfilmentLookupInput): Promise<FulfilmentOrder[]>;

  createFulfilment(
    input: CreateFulfilmentInput
  ): Promise<CreateFulfilmentResult>;

  updateTracking(input: UpdateTrackingInput): Promise<void>;

  cancelFulfilment(input: CancelFulfilmentInput): Promise<void>;
}
