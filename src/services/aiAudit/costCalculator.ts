type ModelPricing = {
  inputPerMillion: number;
  outputPerMillion: number;
};

const MODEL_PRICING_USD: Record<string, ModelPricing> = {
  "gpt-4o-mini": {
    inputPerMillion: 0.15,
    outputPerMillion: 0.6,
  },
  "gpt-4o": {
    inputPerMillion: 5,
    outputPerMillion: 15,
  },
  "gpt-5.4": {
    inputPerMillion: 2.5,
    outputPerMillion: 15,
  },
  "gpt-5.4-mini": {
    inputPerMillion: 0.75,
    outputPerMillion: 4.5,
  },
  "gpt-5.4-nano": {
    inputPerMillion: 0.2,
    outputPerMillion: 1.25,
  },
  "gpt-5.5": {
    inputPerMillion: 5,
    outputPerMillion: 30,
  },
  "gpt-5.6-luna": {
    inputPerMillion: 1,
    outputPerMillion: 6,
  },
  "gpt-5.6-terra": {
    inputPerMillion: 2.5,
    outputPerMillion: 15,
  },
  "gpt-5.6-sol": {
    inputPerMillion: 5,
    outputPerMillion: 30,
  },
};

function normaliseModel(model: string) {
  return model.trim().toLowerCase();
}

export function calculateCost(
  model: string,
  promptTokens: number,
  completionTokens: number
) {
  const pricing = MODEL_PRICING_USD[normaliseModel(model)];

  if (!pricing) return 0;

  const inputCost = (promptTokens / 1_000_000) * pricing.inputPerMillion;
  const outputCost =
    (completionTokens / 1_000_000) * pricing.outputPerMillion;

  return Math.round((inputCost + outputCost) * 1_000_000) / 1_000_000;
}
