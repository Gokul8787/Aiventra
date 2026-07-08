import "@/services/trends";
import { Product } from "@/ai/types/product";
import { getProviders } from "@/services/trends/providerRegistry";

export type SourceStatus = {
  name: string;
  status: "success" | "failed";
  count: number;
  error?: string;
};

export async function collectTrendingProducts(): Promise<{
  products: Product[];
  sources: SourceStatus[];
}> {
  const providers = getProviders();

  const products: Product[] = [];
  const sources: SourceStatus[] = [];

  for (const provider of providers) {
    try {
      const providerProducts = await provider.getProducts();

      products.push(...providerProducts);

      sources.push({
        name: provider.name,
        status: "success",
        count: providerProducts.length,
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
