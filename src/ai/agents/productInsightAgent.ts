import { Product } from "../types/product";

export async function generateProductInsight(product: Product): Promise<string> {
  try {
    const { openai, OPENAI_MODEL } = await import("@/services/openai/client");

    const response = await openai.chat.completions.create({
      model: OPENAI_MODEL,
      messages: [
        {
          role: "system",
          content:
            "You are Aiventra AI, an expert ecommerce product analyst. Give short, practical product recommendations.",
        },
        {
          role: "user",
          content: `Analyze this product and explain why it may be a good dropshipping product:
Product: ${product.name}
Category: ${product.category}
Supplier price: £${product.supplierPrice}
Sell price: £${product.sellPrice}
Shipping days: ${product.shippingDays}
Trend score: ${product.trendScore}
Competition score: ${product.competitionScore}
Profit margin: ${product.profitMargin}%
AI score: ${product.aiScore}

Keep the answer under 40 words.`,
        },
      ],
    });

    return response.choices[0]?.message?.content || product.reason;
  } catch {
    return product.reason;
  }
}
