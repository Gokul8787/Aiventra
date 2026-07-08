import { NextResponse } from "next/server";
import { collectTrendingProducts } from "@/ai/agents/trendCollector";
import { scoreProducts } from "@/ai/agents/productScorer";
import { addReasoning } from "@/ai/agents/reasoningEngine";
import { getTopRecommendations } from "@/ai/agents/recommendationEngine";
import { generateProductInsight } from "@/ai/agents/productInsightAgent";

export async function GET() {
  try {
    const { products, sources } = await collectTrendingProducts();
    const scoredProducts = scoreProducts(products);
    const productsWithReasoning = addReasoning(scoredProducts);
    const recommendations = await Promise.all(
      getTopRecommendations(productsWithReasoning).map(async (product) => ({
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
