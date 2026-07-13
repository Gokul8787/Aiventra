import { NextResponse } from "next/server";
import { ProductSchema } from "@/validation/productSchemas";
import { generatePublishingPackage } from "@/ai/publishing/publishingEngine";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = ProductSchema.safeParse(body.product);

    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          message: "Invalid product data.",
          errors: parsed.error.flatten(),
        },
        { status: 400 }
      );
    }

    const product = parsed.data;

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
            : "Publishing package generation failed.",
      },
      { status: 500 }
    );
  }
}
