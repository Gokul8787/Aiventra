import { describe, expect, it } from "vitest";

import type { Product } from "@/ai/types/product";
import { deduplicateProducts } from "./deduplicateProducts";
import { filterDiscoveryProducts } from "./filterDiscoveryProducts";
import { getDiscoveryQueries } from "./queryRotation";

function product(overrides: Partial<Product> = {}): Product {
  return {
    id: "product-1",
    name: "Kitchen Tool",
    category: "Home & Kitchen",
    supplier: "CJ Dropshipping",
    supplierPrice: 12,
    sellPrice: 29.99,
    shippingDays: 7,
    trendScore: 70,
    competitionScore: 50,
    profitMargin: 50,
    aiScore: 0,
    reason: "",
    provider: "cjdropshipping",
    stock: 50,
    ...overrides,
  };
}

describe("getDiscoveryQueries", () => {
  it("rotates broad queries deterministically for a seed", () => {
    const first = getDiscoveryQueries({ mode: "broad" }, "2026-07-15");
    const second = getDiscoveryQueries({ mode: "broad" }, "2026-07-15");

    expect(first).toEqual(second);
    expect(first.length).toBeLessThanOrEqual(20);
    expect(first[0].query).not.toBe("pet accessory");
  });

  it("returns only the selected category queries for category mode", () => {
    const queries = getDiscoveryQueries({
      mode: "category",
      categoryId: "home-kitchen",
    });

    expect(queries.length).toBeGreaterThan(0);
    expect(queries.every((query) => query.categoryId === "home-kitchen")).toBe(
      true
    );
  });

  it("returns one query for keyword mode", () => {
    const queries = getDiscoveryQueries({
      mode: "keyword",
      keyword: "portable blender",
    });

    expect(queries).toHaveLength(1);
    expect(queries[0].query).toBe("portable blender");
  });
});

describe("deduplicateProducts", () => {
  it("keeps the higher stock product when provider and external id match", () => {
    const products = deduplicateProducts([
      product({ id: "same", stock: 10 }),
      product({ id: "same", stock: 100 }),
    ]);

    expect(products).toHaveLength(1);
    expect(products[0].stock).toBe(100);
  });
});

describe("filterDiscoveryProducts", () => {
  it("rejects low stock and invalid price candidates", () => {
    const filtered = filterDiscoveryProducts([
      product({ id: "accepted" }),
      product({ id: "low-stock", stock: 3 }),
      product({ id: "bad-price", supplierPrice: 75 }),
    ]);

    expect(filtered.accepted.map((item) => item.id)).toEqual(["accepted"]);
    expect(filtered.rejected).toHaveLength(2);
  });
});
