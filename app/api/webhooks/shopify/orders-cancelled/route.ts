import { NextResponse } from "next/server";
import { processShopifyCancellationWebhook } from "@/services/connectors/shopify/webhooks/processOrderWebhook";
import { SHOPIFY_WEBHOOK_EVENTS } from "@/services/connectors/shopify/webhooks/webhookEvents";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function errorStatus(error: unknown) {
  const message = error instanceof Error ? error.message : "";

  return message.includes("HMAC") ? 401 : 400;
}

export async function POST(request: Request) {
  try {
    const result = await processShopifyCancellationWebhook({
      request,
      topic: SHOPIFY_WEBHOOK_EVENTS.ordersCancelled,
    });

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message:
          error instanceof Error ? error.message : "Shopify webhook failed.",
      },
      { status: errorStatus(error) }
    );
  }
}
