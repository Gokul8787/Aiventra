import { NextResponse } from "next/server";
import { createApiErrorResponse } from "@/auth/apiErrorResponse";
import { requireApiContext } from "@/auth/requireApiContext";
import { publishEvent } from "@/services/events/eventRepository";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const context = await requireApiContext(request, "product_scan.run");

    const eventId = await publishEvent({
      tenantContext: context.tenantContext,
      eventType: "ProductScanRequested",
      aggregateType: "product_scan_request",
      aggregateId: crypto.randomUUID(),
      payload: {
        searchQuery: body.searchQuery || "pet",
      },
    });

    return NextResponse.json(
      {
        success: true,
        tenantContext: context.tenantContext,
        eventId,
        status: "queued",
      },
      { status: 202 }
    );
  } catch (error) {
    return createApiErrorResponse(error);
  }
}
