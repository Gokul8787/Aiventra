import { Product } from "../types/product";
import type { TenantContext } from "@/context/storeContext";
import { PROMPTS } from "@/services/aiAudit/promptVersions";
import { AIService, OPENAI_MODEL } from "@/services/openai/OpenAIService";

export async function generateProductInsight(
  product: Product,
  context?: {
    tenantContext?: TenantContext;
    jobId?: string;
    productId?: string;
  }
): Promise<string> {
  try {
    const systemPrompt =
      "You are Aiventra AI, an expert ecommerce product analyst. Give short, practical product recommendations.";

    const userPrompt = `Analyze this product and explain why it may be a good dropshipping product:
Product: ${product.name}
Category: ${product.category}
Supplier price: £${product.supplierPrice}
Sell price: £${product.sellPrice}
Shipping days: ${product.shippingDays}
Trend score: ${product.trendScore}
Competition score: ${product.competitionScore}
Profit margin: ${product.profitMargin}%
AI score: ${product.aiScore}
AI decision: ${product.decision?.decision || "Unknown"}
Decision reasons: ${
      product.decision?.reasons.map((reason) => reason.message).join(", ") ||
      "Unknown"
    }
Memory seen count: ${product.memory?.timesSeen ?? 0}
Memory prior sales: ${product.memory?.timesSold ?? 0}
Memory supplier changes: ${product.memory?.supplierChanges ?? 0}

Keep the answer under 40 words.`;

    const result = await AIService.generate({
      feature: "PRODUCT_REASONING",
      model: OPENAI_MODEL,
      version: PROMPTS.PRODUCT_REASONING,
      systemPrompt,
      userPrompt,
      input: {
        productId: product.id,
        productName: product.name,
        category: product.category,
        supplier: product.supplier,
        aiScore: product.aiScore,
        decision: product.decision?.decision,
        memory: product.memory,
      },
      jobId: context?.jobId,
      productId: context?.productId || product.databaseId,
      tenantContext: context?.tenantContext,
      templateId: "product-reasoning",
      templateVersion: PROMPTS.PRODUCT_REASONING,
      variables: {
        productName: product.name,
        category: product.category,
        supplierPrice: product.supplierPrice,
        sellPrice: product.sellPrice,
        shippingDays: product.shippingDays,
        trendScore: product.trendScore,
        competitionScore: product.competitionScore,
        profitMargin: product.profitMargin,
        aiScore: product.aiScore,
        decision: product.decision?.decision || "Unknown",
        memoryTimesSeen: product.memory?.timesSeen ?? 0,
        memoryTimesSold: product.memory?.timesSold ?? 0,
        memorySupplierChanges: product.memory?.supplierChanges ?? 0,
      },
    });

    return result.text || product.reason;
  } catch {
    return product.reason;
  }
}
