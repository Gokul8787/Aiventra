import "server-only";

import type { Product } from "@/ai/types/product";
import { getCJProducts } from "@/services/cjdropshipping/products";
import { normalizeCJProduct } from "@/services/normalizers/cjNormalizer";

import { DISCOVERY_SETTINGS } from "./discoveryConfig";
import { deduplicateProducts } from "./deduplicateProducts";
import {
  filterDiscoveryProducts,
  summariseDiscoveryReasons,
} from "./filterDiscoveryProducts";
import { getDiscoveryQueries } from "./queryRotation";
import type { ProductScanRequest } from "./productScanRequest";

export type CJDiscoverySourceResult = {
  query: string;
  category: string;
  status: "success" | "failed";
  count: number;
  error?: string;
};

export type CJDiscoveryStats = {
  queriesCompleted: number;
  queriesPlanned: number;
  categoriesCovered: number;
  rawProducts: number;
  uniqueProducts: number;
  passedFirstFilter: number;
  rejectedCount: number;
};

function withDiscoveryCategory(product: Product, categoryName: string): Product {
  return {
    ...product,
    category:
      product.category && product.category !== "General"
        ? product.category
        : categoryName,
  };
}

export async function discoverCJProducts(
  request: ProductScanRequest = { mode: "broad" }
): Promise<{
  products: Product[];
  sources: CJDiscoverySourceResult[];
  rejectedCount: number;
  stats: CJDiscoveryStats;
  rejectionSummary: Record<string, number>;
  rejectionSamples: Array<{
    productId: string;
    productName: string;
    reasons: string[];
  }>;
  warningSummary: Record<string, number>;
  rawProductFieldNames: string[];
}> {
  const queries = getDiscoveryQueries(request);

  const collected: Product[] = [];
  const sources: CJDiscoverySourceResult[] = [];
  const coveredCategories = new Set<string>();
  let rawProductFieldNames: string[] = [];

  // Intentionally sequential because CJ is globally limited to one request per second.
  for (const discoveryQuery of queries) {
    try {
      const cjProducts = await getCJProducts(discoveryQuery.query);
      if (rawProductFieldNames.length === 0) {
        const firstRawProduct = cjProducts[0] as
          | Record<string, unknown>
          | undefined;

        rawProductFieldNames = firstRawProduct
          ? Object.keys(firstRawProduct).sort()
          : [];
      }
      const limitedProducts = cjProducts.slice(0, discoveryQuery.maximumProducts);
      const normalizedProducts = limitedProducts
        .map(normalizeCJProduct)
        .map((product) =>
          withDiscoveryCategory(product, discoveryQuery.categoryName)
        );

      collected.push(...normalizedProducts);
      coveredCategories.add(discoveryQuery.categoryId);

      sources.push({
        query: discoveryQuery.query,
        category: discoveryQuery.categoryName,
        status: "success",
        count: limitedProducts.length,
      });
    } catch (error) {
      sources.push({
        query: discoveryQuery.query,
        category: discoveryQuery.categoryName,
        status: "failed",
        count: 0,
        error:
          error instanceof Error
            ? error.message
            : "Unknown CJ discovery error.",
      });
    }

    if (collected.length >= DISCOVERY_SETTINGS.maximumTotalProducts) {
      break;
    }
  }

  const uniqueProducts = deduplicateProducts(collected);
  const filtered = filterDiscoveryProducts(uniqueProducts);
  const rejectionSummary = summariseDiscoveryReasons(filtered.rejected);
  const warningSummary = summariseDiscoveryReasons(
    filtered.warnings.map((item) => ({
      ...item,
      reasons: item.warnings,
    }))
  );
  const products = filtered.accepted
    .slice(
      0,
      DISCOVERY_SETTINGS.maximumTotalProducts
    )
    .map((candidate) => candidate.product);

  return {
    products,
    sources,
    rejectedCount: filtered.rejected.length,
    stats: {
      queriesCompleted: sources.filter((source) => source.status === "success")
        .length,
      queriesPlanned: queries.length,
      categoriesCovered: coveredCategories.size,
      rawProducts: collected.length,
      uniqueProducts: uniqueProducts.length,
      passedFirstFilter: products.length,
      rejectedCount: filtered.rejected.length,
    },
    rejectionSummary,
    warningSummary,
    rejectionSamples: filtered.rejected.slice(0, 5),
    rawProductFieldNames,
  };
}
