import { NextResponse } from "next/server";
import { ProductSchema } from "@/validation/productSchemas";
import { generatePublishingPackage } from "@/ai/publishing/publishingEngine";
import { publishToShopify } from "@/services/connectors/shopify/products";

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

    // Always regenerate server-side.
    const publishingPackage = await generatePublishingPackage({
      product,
      brandName: "Aiventra",
      targetMarket: "United Kingdom",
    });

    if (!publishingPackage.validationPassed) {
      return NextResponse.json(
        {
          success: false,
          message: "The server-generated publishing package failed validation.",
          errors: publishingPackage.validationErrors,
        },
        { status: 400 }
      );
    }

    const result = await publishToShopify({
      title: publishingPackage.title,
      description: publishingPackage.description,
      price: publishingPackage.sellPrice,
      compareAtPrice: publishingPackage.compareAtPrice,
      tags: publishingPackage.tags,
      collections: publishingPackage.collections,
      handle: publishingPackage.handle,
      imageUrl: product.imageUrl,
      imageAltText: publishingPackage.imageAltText,
      seoTitle: publishingPackage.seoTitle,
      seoDescription: publishingPackage.seoDescription,
      productType: product.category,
      vendor: "Aiventra",
    });

    return NextResponse.json({
      success: true,
      result,
      publishingPackage,
      publishedAt: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message:
          error instanceof Error
            ? error.message
            : "Shopify draft publishing failed.",
      },
      { status: 500 }
    );
  }
}
