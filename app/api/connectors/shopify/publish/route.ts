import { NextResponse } from "next/server";
import { Product } from "@/ai/types/product";
import { ProductPublishingOutput } from "@/ai/publishing/types";
import { publishToShopify } from "@/services/connectors/shopify/products";

type PublishRequest = {
  product?: Product;
  publishingPackage?: ProductPublishingOutput;
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as PublishRequest;

    if (!body.product) {
      return NextResponse.json(
        {
          success: false,
          message: "Product is required.",
        },
        { status: 400 }
      );
    }

    if (!body.publishingPackage) {
      return NextResponse.json(
        {
          success: false,
          message: "Publishing package is required.",
        },
        { status: 400 }
      );
    }

    if (!body.publishingPackage.validationPassed) {
      return NextResponse.json(
        {
          success: false,
          message: "The publishing package failed validation.",
          errors: body.publishingPackage.validationErrors,
        },
        { status: 400 }
      );
    }

    const result = await publishToShopify({
      title: body.publishingPackage.title,
      description: body.publishingPackage.description,
      price: body.publishingPackage.sellPrice,
      compareAtPrice: body.publishingPackage.compareAtPrice,
      tags: body.publishingPackage.tags,
      collections: body.publishingPackage.collections,
      handle: body.publishingPackage.handle,
      imageUrl: body.product.imageUrl,
      imageAltText: body.publishingPackage.imageAltText,
      seoTitle: body.publishingPackage.seoTitle,
      seoDescription: body.publishingPackage.seoDescription,
      productType: body.product.category,
      vendor: "Aiventra",
    });

    return NextResponse.json({
      success: true,
      result,
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
