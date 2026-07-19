import type { ProductScanRequest } from "./productScanRequest";
import { DISCOVERY_CATEGORIES, DISCOVERY_SETTINGS } from "./discoveryConfig";

export type DiscoveryQuery = {
  categoryId: string;
  categoryName: string;
  query: string;
  maximumProducts: number;
};

function getBroadQueries(): DiscoveryQuery[] {
  return DISCOVERY_CATEGORIES.filter((category) => category.enabled).flatMap(
    (category) =>
      category.searchQueries.map((query) => ({
        categoryId: category.id,
        categoryName: category.name,
        query,
        maximumProducts: category.maximumProductsPerQuery,
      }))
  );
}

function getCategoryQueries(categoryId: string): DiscoveryQuery[] {
  const category = DISCOVERY_CATEGORIES.find(
    (candidate) => candidate.enabled && candidate.id === categoryId
  );

  if (!category) return [];

  return category.searchQueries
    .map((query) => ({
      categoryId: category.id,
      categoryName: category.name,
      query,
      maximumProducts: category.maximumProductsPerQuery,
    }))
    .slice(0, DISCOVERY_SETTINGS.maximumQueriesPerRun);
}

export function getDiscoveryQueries(
  request: ProductScanRequest = { mode: "broad" },
  seed = new Date().toISOString().slice(0, 10)
): DiscoveryQuery[] {
  if (request.mode === "keyword") {
    return [
      {
        categoryId: "keyword",
        categoryName: "Keyword Search",
        query: request.keyword || "",
        maximumProducts: Math.min(20, DISCOVERY_SETTINGS.maximumTotalProducts),
      },
    ];
  }

  if (request.mode === "category" && request.categoryId) {
    return getCategoryQueries(request.categoryId);
  }

  const queries = getBroadQueries();

  // Deterministic daily rotation.
  const seedValue = Array.from(seed).reduce(
    (total, character) => total + character.charCodeAt(0),
    0
  );

  const rotated = queries.map((_, index) => {
    return queries[(index + seedValue) % queries.length];
  });

  return rotated.slice(0, DISCOVERY_SETTINGS.maximumQueriesPerRun);
}
