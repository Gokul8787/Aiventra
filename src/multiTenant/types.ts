export interface Organisation {
  id: string;
  name: string;
  slug: string;
  timezone: string;
  currency: string;
  country: string;
  active: boolean;
  createdAt: string;
}

export interface Store {
  id: string;
  organisationId: string;
  name: string;
  platform: "shopify";
  currency: string;
  country: string;
  timezone: string;
  active: boolean;
  createdAt: string;
}

export interface TenantContext {
  organisationId: string;
  storeId: string;
  userId?: string;
  timezone: string;
  currency: string;
  locale: string;
  country?: string;
  organisationName?: string;
  storeName?: string;
}
