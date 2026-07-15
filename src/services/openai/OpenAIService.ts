import "server-only";

import { calculateCost } from "@/services/aiAudit/costCalculator";
import { savePrompt, saveResponse } from "@/services/aiAudit/AIAuditRepository";
import { createTimer } from "@/services/aiAudit/timer";
import { AIRequest, AIResult } from "@/services/aiAudit/types";
import { OPENAI_MODEL, openai } from "./client";

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Unknown OpenAI error.";
}

async function recordResponse(input: {
  tenantContext?: AIRequest["tenantContext"];
  promptId: string;
  result: AIResult;
  model: string;
}) {
  try {
    await saveResponse(input);
  } catch (error) {
    console.error("Failed to save AI response audit:", error);
  }
}

export async function generate(input: AIRequest): Promise<AIResult> {
  const promptId = await savePrompt(input);
  const timer = createTimer();

  try {
    const response = await openai.chat.completions.create({
      model: input.model,
      messages: [
        {
          role: "system",
          content: input.systemPrompt,
        },
        {
          role: "user",
          content: input.userPrompt,
        },
      ],
    });

    const promptTokens = response.usage?.prompt_tokens || 0;
    const completionTokens = response.usage?.completion_tokens || 0;
    const totalTokens =
      response.usage?.total_tokens || promptTokens + completionTokens;
    const model = response.model || input.model;

    const result: AIResult = {
      text: response.choices[0]?.message?.content || "",
      output: response,
      finishReason: response.choices[0]?.finish_reason || "unknown",
      usage: {
        promptTokens,
        completionTokens,
        totalTokens,
        latency: timer.elapsedMs(),
        cost: calculateCost(model, promptTokens, completionTokens),
      },
    };

    await recordResponse({
      tenantContext: input.tenantContext,
      promptId,
      result,
      model,
    });

    return result;
  } catch (error) {
    const message = getErrorMessage(error);
    const result: AIResult = {
      text: "",
      output: {
        errorType: error instanceof Error ? error.name : "OpenAIError",
        errorMessage: message,
      },
      finishReason: "error",
      usage: {
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0,
        latency: timer.elapsedMs(),
        cost: 0,
      },
    };

    await recordResponse({
      tenantContext: input.tenantContext,
      promptId,
      result,
      model: input.model,
    });

    throw error;
  }
}

export const AIService = {
  generate,
};

export { OPENAI_MODEL };
