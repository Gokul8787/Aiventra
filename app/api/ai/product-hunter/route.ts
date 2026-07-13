import { NextResponse } from "next/server";
import { collectTrendingProducts } from "@/ai/agents/trendCollector";
import { addReasoning } from "@/ai/agents/reasoningEngine";
import {
  getTopRecommendations,
  RECOMMENDATION_THRESHOLD,
} from "@/ai/agents/recommendationEngine";
import { generateProductInsight } from "@/ai/agents/productInsightAgent";
import { analyzeProductIntelligence } from "@/ai/intelligence/productIntelligenceEngine";
import { persistProductHunterRun } from "@/services/productHunter/persistProductHunterRun";
import { getProductPersistenceKey } from "@/services/repositories/productsRepository";

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

    const persistence = await persistProductHunterRun({
      products: intelligentProducts,
      recommendations,
      sources,
      recommendationThreshold: RECOMMENDATION_THRESHOLD,
      searchQuery: "pet",
    });

    const persistedRecommendations = recommendations.map((product) => ({
      ...product,
      databaseId:
        persistence.productDatabaseIds[getProductPersistenceKey(product)],
    }));

    return NextResponse.json({
      success: true,
      jobId: persistence.jobId,
      scanId: persistence.scanId,
      totalProducts: intelligentProducts.length,
      recommendedProducts: recommendations.length,
      sources,
      products: persistedRecommendations,
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("AI Product Hunter failed:", error);

    return NextResponse.json(
      {
        success: false,
        message: "AI Product Hunter failed",
      },
      { status: 500 }
    );
  }
}
