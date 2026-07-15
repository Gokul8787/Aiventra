import "server-only";

import type { TenantContext } from "@/multiTenant/types";

const DEMO_ORGANISATION_ID = "00000000-0000-4000-8000-000000000001";
const DEMO_STORE_ID = "00000000-0000-4000-8000-000000000002";

function getHeader(request: Request | undefined, name: string) {
  return request?.headers.get(name)?.trim() || undefined;
}

function getContextValue(
  request: Request | undefined,
  headerName: string,
  environmentName: string,
  fallback: string
) {
  return (
    getHeader(request, headerName) ||
    process.env[environmentName]?.trim() ||
    fallback
  );
}

export async function resolveStoreContext(
  request?: Request
): Promise<TenantContext> {
  return {
    organisationId: getContextValue(
      request,
      "x-aiventra-organisation-id",
      "DEFAULT_ORGANISATION_ID",
      DEMO_ORGANISATION_ID
    ),
    storeId: getContextValue(
      request,
      "x-aiventra-store-id",
      "DEFAULT_STORE_ID",
      DEMO_STORE_ID
    ),
    userId: getHeader(request, "x-aiventra-user-id"),
    timezone: getContextValue(
      request,
      "x-aiventra-timezone",
      "DEFAULT_STORE_TIMEZONE",
      "Europe/London"
    ),
    currency: getContextValue(
      request,
      "x-aiventra-currency",
      "DEFAULT_STORE_CURRENCY",
      "GBP"
    ),
    locale: getContextValue(
      request,
      "x-aiventra-locale",
      "DEFAULT_STORE_LOCALE",
      "en-GB"
    ),
    organisationName:
      getHeader(request, "x-aiventra-organisation-name") ||
      process.env.DEFAULT_ORGANISATION_NAME ||
      "Aiventra Demo",
    storeName:
      getHeader(request, "x-aiventra-store-name") ||
      process.env.DEFAULT_STORE_NAME ||
      "Aiventra Shopify",
  };
}
