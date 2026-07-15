import type { EvidenceProvider } from "@/evidence/types";

export class CJInventoryProvider implements EvidenceProvider {
  readonly id = "cj";
  readonly name = "CJ Inventory";
  readonly category = "inventory";
  readonly version = "1.0.0";
  readonly cacheTtlSeconds = 15 * 60;
  readonly enabled = true;

  async collect({ product }: Parameters<EvidenceProvider["collect"]>[0]) {
    if (product.provider !== "cjdropshipping") return null;

    const startedAt = Date.now();
    const now = new Date();
    const available = product.stock ?? 0;

    return {
      id: crypto.randomUUID(),
      provider: this.id,
      category: this.category,
      verified: product.stock !== undefined,
      confidence: product.stock !== undefined ? 88 : 10,
      quality: available >= 100 ? 90 : available >= 20 ? 65 : 25,
      retrievedAt: now.toISOString(),
      expiresAt: new Date(now.getTime() + this.cacheTtlSeconds * 1000).toISOString(),
      cost: 0,
      latency: Date.now() - startedAt,
      data: {
        available,
        reserved: 0,
        warehouse: "CJ",
        source: "CJ product list API",
        externalProductId: product.id,
      },
    };
  }
}
