import { describe, expect, it } from "vitest";

import fs from "node:fs";
import path from "node:path";

const REPOSITORY_ROOT = path.join(
  process.cwd(),
  "src/services/repositories"
);

const TENANT_TABLES = [
  "products",
  "product_scans",
  "ai_jobs",
  "orders",
  "order_items",
  "supplier_orders",
  "publishing_packages",
  "product_publications",
  "platform_fulfilments",
  "cancellation_requests",
  "operations_alerts",
  "dead_letter_items",
];

function readAllRepositoryFiles(): string[] {
  return fs
    .readdirSync(REPOSITORY_ROOT)
    .filter((file) => file.endsWith(".ts"))
    .map((file) =>
      fs.readFileSync(path.join(REPOSITORY_ROOT, file), "utf8")
    );
}

describe("tenant repository isolation", () => {
  it("does not contain obvious unscoped tenant-table reads", () => {
    const files = readAllRepositoryFiles();

    for (const table of TENANT_TABLES) {
      const matchingFiles = files.filter((source) =>
        source.includes(`.from("${table}")`)
      );

      for (const source of matchingFiles) {
        expect(source.includes("organisation_id")).toBe(true);
        expect(source.includes("store_id")).toBe(true);
      }
    }
  });
});
