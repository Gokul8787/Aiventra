import "server-only";
import { supabaseAdmin } from "@/services/supabase/admin";
import { Product } from "@/ai/types/product";
import {
  getProductPersistenceKey,
  PersistedProduct,
} from "./productsRepository";

export async function saveProductIntelligence(input: {
  scanId: string;
  products: Product[];
  persistedProducts: Map<string, PersistedProduct>;
}): Promise<void> {
  const rows = input.products.flatMap((product) => {
    const intelligence = product.intelligence;

    if (!intelligence) return [];

    const persistedProduct = input.persistedProducts.get(
      getProductPersistenceKey(product)
    );

    if (!persistedProduct) return [];

    return [
      {
        scan_id: input.scanId,
        product_id: persistedProduct.id,

        demand_score: intelligence.demand.demandScore,

        competition_score:
          intelligence.competition.competitionOpportunityScore,

        profit_score: intelligence.profit.profitScore,

        shipping_score: intelligence.shipping.shippingScore,

        supplier_score: intelligence.supplier.supplierScore,

        review_score: intelligence.reviews.reviewScore,

        seasonality_score: intelligence.seasonality.seasonalityScore,

        confidence_score: intelligence.confidence.confidenceScore,

        overall_score: intelligence.overallScore,

        data_quality_status: intelligence.dataQuality.status,

        estimated_fields: intelligence.dataQuality.estimatedFields,

        analysis: intelligence,
        calculated_at: new Date().toISOString(),
      },
    ];
  });

  if (rows.length === 0) return;

  const { error } = await supabaseAdmin
    .from("product_intelligence")
    .upsert(rows, {
      onConflict: "scan_id,product_id",
    });

  if (error) {
    throw new Error(`Failed to save product intelligence: ${error.message}`);
  }
}
