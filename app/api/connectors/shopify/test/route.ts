import { NextResponse } from "next/server";
import { createApiErrorResponse } from "@/auth/apiErrorResponse";
import { requireApiContext } from "@/auth/requireApiContext";
import { testShopifyConnection } from "@/services/connectors/shopify/connection";

export async function GET(request: Request) {
  try {
    const context = await requireApiContext(request, "audit.read");
    const connection = await testShopifyConnection();

    return NextResponse.json({
      success: true,
      tenantContext: context.tenantContext,
      connection,
      checkedAt: new Date().toISOString(),
    });
  } catch (error) {
    return createApiErrorResponse(error);
  }
}
