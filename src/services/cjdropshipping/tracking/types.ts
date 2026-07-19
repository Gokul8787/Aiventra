export type CJTrackingEventResponse = {
  id?: string;
  trackingId?: string;
  status?: string;
  statusCode?: string;
  description?: string;
  details?: string;
  location?: string;
  city?: string;
  country?: string;
  eventTime?: string;
  trackingTime?: string;
  createDate?: string;
};

export type CJTrackingDataResponse = {
  orderId?: string;
  orderNum?: string;
  trackingNumber?: string;
  trackingNo?: string;
  logisticTrackingNumber?: string;
  trackingUrl?: string;
  logisticName?: string;
  logisticsName?: string;
  carrierName?: string;
  logisticCode?: string;
  carrierCode?: string;
  status?: string;
  trackingStatus?: string;
  shippedAt?: string;
  shippedDate?: string;
  deliveredAt?: string;
  deliveredDate?: string;
  events?: CJTrackingEventResponse[];
  trackingEvents?: CJTrackingEventResponse[];
  trackings?: CJTrackingEventResponse[];
};

export type CJTrackingApiResponse = {
  code?: number;
  result?: boolean;
  success?: boolean;
  message?: string;
  data?: CJTrackingDataResponse | CJTrackingDataResponse[];
  requestId?: string;
  pointsInfo?: {
    total?: number;
    usedToday?: number;
    remaining?: number;
  };
};
