import { NextResponse } from "next/server";
import { testShopifyConnection } from "@/services/connectors/shopify/connection";

export async function GET() {
  try {
    const connection = await testShopifyConnection();

    return NextResponse.json({
      success: true,
      connection,
      checkedAt: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message:
          error instanceof Error
            ? error.message
            : "Shopify connection test failed.",
      },
      { status: 500 }
    );
  }
}
