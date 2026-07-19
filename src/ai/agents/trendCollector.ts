import "@/services/trends";
import { Product } from "@/ai/types/product";
import { getProviders } from "@/services/trends/providerRegistry";
import type { ProductScanRequest } from "@/services/productDiscovery/productScanRequest";
import type { TrendProviderResult } from "@/services/trends/types";

export type SourceStatus = {
  name: string;
  status: "success" | "failed" | "skipped";
  count: number;
  error?: string;
  metadata?: Record<string, unknown>;
};

function normalizeProviderResult(
  result: Product[] | TrendProviderResult
): TrendProviderResult {
  return Array.isArray(result) ? { products: result } : result;
}

export async function collectTrendingProducts(
  request: ProductScanRequest = { mode: "broad" }
): Promise<{
  products: Product[];
  sources: SourceStatus[];
}> {
  const providers = getProviders();

  const products: Product[] = [];
  const sources: SourceStatus[] = [];

  for (const provider of providers) {
    try {
      const providerResult = normalizeProviderResult(
        await provider.getProducts(request)
      );

      products.push(...providerResult.products);

      sources.push({
        name: provider.name,
        status: "success",
        count: providerResult.products.length,
        metadata: providerResult.metadata,
      });
    } catch (error) {
      sources.push({
        name: provider.name,
        status: "failed",
        count: 0,
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  return { products, sources };
}
