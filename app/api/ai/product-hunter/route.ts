import { NextResponse } from "next/server";
import { collectTrendingProducts } from "@/ai/agents/trendCollector";
import { addReasoning } from "@/ai/agents/reasoningEngine";
import { getTopRecommendations } from "@/ai/agents/recommendationEngine";
import { generateProductInsight } from "@/ai/agents/productInsightAgent";
import { analyzeProductIntelligence } from "@/ai/intelligence/productIntelligenceEngine";

export async function GET() {
  try {
    const { products, sources } = await collectTrendingProducts();
    const productsWithReasoning = addReasoning(products);
    const intelligentProducts = productsWithReasoning.map((product) => {
      const intelligence = analyzeProductIntelligence(product);

      return {
        ...product,
        aiScore: intelligence.overallScore,
        intelligence,
      };
    });

    const recommendations = await Promise.all(
      getTopRecommendations(intelligentProducts).map(async (product) => ({
        ...product,
        reason: await generateProductInsight(product),
      }))
    );

    return NextResponse.json({
      success: true,
      totalProducts: products.length,
      recommendedProducts: recommendations.length,
      sources,
      products: recommendations,
      generatedAt: new Date().toISOString(),
    });
  } catch {
    return NextResponse.json(
      {
        success: false,
        message: "AI Product Hunter failed",
      },
      { status: 500 }
    );
  }
}
