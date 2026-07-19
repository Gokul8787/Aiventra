import { describe, expect, it } from "vitest";

import type { Product } from "@/ai/types/product";
import {
  normalizeCJProduct,
  parseCJNumber,
} from "@/services/normalizers/cjNormalizer";
import { deduplicateProducts } from "./deduplicateProducts";
import {
  filterDiscoveryProducts,
  summariseDiscoveryReasons,
} from "./filterDiscoveryProducts";
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
    discoverySignals: {
      supplierPriceKnown: true,
      stockKnown: true,
    },
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
  it("rejects only confirmed low stock and over-max price candidates", () => {
    const filtered = filterDiscoveryProducts([
      product({ id: "accepted" }),
      product({ id: "low-stock", stock: 3 }),
      product({ id: "bad-price", supplierPrice: 75 }),
    ]);

    expect(filtered.accepted.map((item) => item.product.id)).toEqual(["accepted"]);
    expect(filtered.rejected).toHaveLength(2);
    expect(filtered.rejected).toEqual([
      expect.objectContaining({
        productId: "low-stock",
        reasons: ["confirmed_stock_below_minimum"],
      }),
      expect.objectContaining({
        productId: "bad-price",
        reasons: ["confirmed_price_above_maximum"],
      }),
    ]);
  });

  it("keeps products with unknown stock or price and adds verification warnings", () => {
    const filtered = filterDiscoveryProducts([
      product({
        id: "unknown-values",
        supplierPrice: 0,
        stock: undefined,
        discoverySignals: {
          supplierPriceKnown: false,
          stockKnown: false,
        },
      }),
    ]);

    expect(filtered.rejected).toHaveLength(0);
    expect(filtered.accepted).toHaveLength(1);
    expect(filtered.accepted[0].warnings).toEqual([
      "stock_requires_live_verification",
      "price_requires_live_verification",
    ]);
    expect(filtered.accepted[0].product.discoveryWarnings).toEqual(
      filtered.accepted[0].warnings
    );
    expect(filtered.warnings).toEqual([
      {
        productId: "unknown-values",
        productName: "Kitchen Tool",
        warnings: [
          "stock_requires_live_verification",
          "price_requires_live_verification",
        ],
      },
    ]);
  });

  it("rejects confirmed zero stock", () => {
    const filtered = filterDiscoveryProducts([
      product({
        id: "out-of-stock",
        stock: 0,
        discoverySignals: {
          supplierPriceKnown: true,
          stockKnown: true,
        },
      }),
    ]);

    expect(filtered.accepted).toHaveLength(0);
    expect(filtered.rejected).toEqual([
      expect.objectContaining({
        productId: "out-of-stock",
        reasons: ["confirmed_stock_below_minimum"],
      }),
    ]);
  });

  it("summarises rejection reasons and warnings", () => {
    const summary = summariseDiscoveryReasons([
      {
        reasons: [
          "confirmed_stock_below_minimum",
          "confirmed_price_above_maximum",
        ],
      },
      {
        reasons: ["confirmed_stock_below_minimum"],
      },
    ]);

    expect(summary).toEqual({
      confirmed_stock_below_minimum: 2,
      confirmed_price_above_maximum: 1,
    });
  });
});

describe("parseCJNumber", () => {
  it("parses ranges conservatively", () => {
    expect(parseCJNumber("2.50--4.80")).toBe(4.8);
  });

  it("parses currency values", () => {
    expect(parseCJNumber("$12.99")).toBe(12.99);
  });

  it("returns undefined for missing values", () => {
    expect(parseCJNumber(undefined)).toBeUndefined();
    expect(parseCJNumber("")).toBeUndefined();
  });
});

describe("normalizeCJProduct", () => {
  it("parses CJ price ranges and preserves unknown inventory", () => {
    const normalized = normalizeCJProduct({
      id: "cj-1",
      productNameEn: "Portable Blender",
      nowPrice: "2.50--4.80",
      inventoryNum: undefined,
    });

    expect(normalized.supplierPrice).toBe(4.8);
    expect(normalized.sellPrice).toBe(12);
    expect(normalized.stock).toBeUndefined();
    expect(normalized.discoverySignals).toEqual({
      supplierPriceKnown: true,
      stockKnown: false,
    });
  });

  it("reads alternate CJ price and inventory fields", () => {
    const normalized = normalizeCJProduct({
      id: "cj-2",
      productNameEn: "Massager",
      productPriceRange: "£10.00 - £15.50",
      totalInventory: "42",
    });

    expect(normalized.supplierPrice).toBe(15.5);
    expect(normalized.stock).toBe(42);
    expect(normalized.discoverySignals).toEqual({
      supplierPriceKnown: true,
      stockKnown: true,
    });
  });
});
