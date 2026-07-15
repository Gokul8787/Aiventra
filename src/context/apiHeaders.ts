export function createTenantHeaders(
  organisationId: string,
  storeId: string
): HeadersInit {
  return {
    "Content-Type": "application/json",
    "x-aiventra-organisation-id": organisationId,
    "x-aiventra-store-id": storeId,
  };
}
