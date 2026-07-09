import { NextResponse } from "next/server";
import { Product } from "@/ai/types/product";
import { generatePublishingPackage } from "@/ai/publishing/publishingEngine";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const product = body.product as Product;

    if (!product) {
      return NextResponse.json(
        { success: false, message: "Product is required" },
        { status: 400 }
      );
    }

    const publishingPackage = await generatePublishingPackage({
      product,
      brandName: "Aiventra",
      targetMarket: "United Kingdom",
    });

    return NextResponse.json({
      success: true,
      product,
      publishingPackage,
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message:
          error instanceof Error
            ? error.message
            : "Publishing package generation failed",
      },
      { status: 500 }
    );
  }
}
