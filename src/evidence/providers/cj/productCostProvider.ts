import type { EvidenceProvider } from "@/evidence/types";

function toNumber(value: unknown) {
  const parsed = Number(value);

  return Number.isFinite(parsed) ? parsed : 0;
}

export class CJProductCostProvider implements EvidenceProvider {
  readonly id = "cj";
  readonly name = "CJ Product Cost";
  readonly category = "product_cost";
  readonly version = "1.0.0";
  readonly cacheTtlSeconds = 6 * 60 * 60;
  readonly enabled = true;

  async collect({ product }: Parameters<EvidenceProvider["collect"]>[0]) {
    if (product.provider !== "cjdropshipping") return null;

    const startedAt = Date.now();
    const cost = toNumber(product.supplierPrice);
    const now = new Date();

    return {
      id: crypto.randomUUID(),
      provider: this.id,
      category: this.category,
      verified: cost > 0,
      confidence: cost > 0 ? 92 : 10,
      quality: cost > 0 ? 95 : 10,
      retrievedAt: now.toISOString(),
      expiresAt: new Date(now.getTime() + this.cacheTtlSeconds * 1000).toISOString(),
      cost: 0,
      latency: Date.now() - startedAt,
      data: {
        cost,
        currency: product.currency || "GBP",
        source: "CJ product list API",
        externalProductId: product.id,
      },
    };
  }
}
