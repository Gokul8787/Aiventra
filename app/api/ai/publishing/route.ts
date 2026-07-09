import { NextResponse } from "next/server";
import { collectTrendingProducts } from "@/ai/agents/trendCollector";
import { analyzeProductIntelligence } from "@/ai/intelligence/productIntelligenceEngine";
import { getTopRecommendations } from "@/ai/agents/recommendationEngine";
import { generatePublishingPackage } from "@/ai/publishing/publishingEngine";

export async function GET() {
  try {
    const { products } = await collectTrendingProducts();

    const intelligentProducts = products.map((product) => {
      const intelligence = analyzeProductIntelligence(product);

      return {
        ...product,
        aiScore: intelligence.overallScore,
        intelligence,
      };
    });

    const [bestProduct] = getTopRecommendations(intelligentProducts, 1);

    if (!bestProduct) {
      return NextResponse.json(
        { success: false, message: "No recommended product found" },
        { status: 404 }
      );
    }

    const publishingPackage = await generatePublishingPackage({
      product: bestProduct,
      brandName: "Aiventra",
      targetMarket: "United Kingdom",
    });

    return NextResponse.json({
      success: true,
      product: bestProduct,
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
