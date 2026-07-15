import type { TenantContext } from "@/multiTenant/types";

export type { TenantContext };

export interface StoreContext {
  organisationId: string;
  storeId: string;
}

export function requireTenantContext(
  context: TenantContext | undefined
): TenantContext {
  if (!context?.organisationId || !context.storeId) {
    throw new Error("Tenant context is required.");
  }

  return context;
}

export function tenantColumns(context: TenantContext) {
  const tenantContext = requireTenantContext(context);

  return {
    organisation_id: tenantContext.organisationId,
    store_id: tenantContext.storeId,
  };
}

export function tenantPayload(context: TenantContext) {
  const tenantContext = requireTenantContext(context);

  return {
    organisationId: tenantContext.organisationId,
    storeId: tenantContext.storeId,
    userId: tenantContext.userId,
    timezone: tenantContext.timezone,
    currency: tenantContext.currency,
    locale: tenantContext.locale,
    organisationName: tenantContext.organisationName,
    storeName: tenantContext.storeName,
  };
}
