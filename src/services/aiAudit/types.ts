import type { TenantContext } from "@/context/storeContext";

export interface AIUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  cost: number;
  latency: number;
}

export interface AIRequest {
  tenantContext?: TenantContext;
  feature: string;
  model: string;
  version: string;
  systemPrompt: string;
  userPrompt: string;
  input?: unknown;
  jobId?: string;
  productId?: string;
  templateId?: string;
  templateVersion?: string;
  variables?: Record<string, unknown>;
}

export interface AIResult {
  text: string;
  output?: unknown;
  usage: AIUsage;
  finishReason: string;
}

export interface AIPromptAudit {
  id: string;
  tenantContext?: TenantContext;
  jobId?: string;
  productId?: string;
  feature: string;
  provider: string;
  model: string;
  promptVersion: string;
  systemPrompt?: string;
  userPrompt?: string;
  input?: unknown;
  createdAt: string;
}

export interface AIResponseAudit {
  id: string;
  promptId: string;
  prompt?: AIPromptAudit;
  response?: string;
  output?: unknown;
  finishReason?: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  latencyMs: number;
  estimatedCost: number;
  model?: string;
  createdAt: string;
}

export interface AICostByDay {
  day: string;
  cost: number;
  tokens: number;
  calls: number;
}

export interface AICostByFeature {
  feature: string;
  cost: number;
  tokens: number;
  calls: number;
}
