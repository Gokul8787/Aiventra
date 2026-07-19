import { NextResponse } from "next/server";
import { createApiErrorResponse } from "@/auth/apiErrorResponse";
import { requireApiContext } from "@/auth/requireApiContext";
import {
  getProductScanSearchLabel,
  ProductScanRequestSchema,
} from "@/services/productDiscovery/productScanRequest";
import { publishEvent } from "@/services/events/eventRepository";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const parsedScanRequest = ProductScanRequestSchema.safeParse(body);

    if (!parsedScanRequest.success) {
      return NextResponse.json(
        {
          success: false,
          message: "Invalid product scan request.",
          errors: parsedScanRequest.error.flatten(),
        },
        { status: 400 }
      );
    }

    const context = await requireApiContext(request, "product_scan.run");

    const eventId = await publishEvent({
      tenantContext: context.tenantContext,
      eventType: "ProductScanRequested",
      aggregateType: "product_scan_request",
      aggregateId: crypto.randomUUID(),
      payload: {
        request: parsedScanRequest.data,
        mode: parsedScanRequest.data.mode,
        categoryId: parsedScanRequest.data.categoryId,
        keyword: parsedScanRequest.data.keyword,
        searchQuery: getProductScanSearchLabel(parsedScanRequest.data),
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
