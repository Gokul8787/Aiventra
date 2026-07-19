import "server-only";

type TenantScope = {
  organisationId: string;
  storeId: string;
};

export function scopeToTenant<T extends {
  eq(column: string, value: string): T;
}>(
  query: T,
  context: TenantScope
): T {
  return query
    .eq("organisation_id", context.organisationId)
    .eq("store_id", context.storeId);
}

export const applyTenantScope = scopeToTenant;
