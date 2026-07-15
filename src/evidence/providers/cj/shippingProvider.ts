import type { EvidenceProvider } from "@/evidence/types";

export class CJShippingProvider implements EvidenceProvider {
  readonly id = "cj";
  readonly name = "CJ Shipping";
  readonly category = "shipping";
  readonly version = "1.0.0";
  readonly cacheTtlSeconds = 6 * 60 * 60;
  readonly enabled = true;

  async collect({ product }: Parameters<EvidenceProvider["collect"]>[0]) {
    if (product.provider !== "cjdropshipping") return null;

    const startedAt = Date.now();
    const now = new Date();
    const shippingCost = product.costAnalysis?.costs.shippingCost ?? 3.99;

    return {
      id: crypto.randomUUID(),
      provider: this.id,
      category: this.category,
      verified: false,
      confidence: 20,
      quality: 25,
      retrievedAt: now.toISOString(),
      expiresAt: new Date(now.getTime() + this.cacheTtlSeconds * 1000).toISOString(),
      cost: 0,
      latency: Date.now() - startedAt,
      data: {
        shippingCost,
        shippingDays: product.shippingDays,
        currency: product.currency || "GBP",
        destinationCountry: "GB",
        carrier: "estimated",
        source: "Estimated fallback until CJ freight quote API is connected",
      },
    };
  }
}
