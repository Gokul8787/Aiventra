import "server-only";

import { supabaseAdmin } from "@/services/supabase/admin";
import type { TenantContext } from "@/context/storeContext";
import { requireTenantContext, tenantColumns } from "@/context/storeContext";
import {
  AICostByDay,
  AICostByFeature,
  AIPromptAudit,
  AIRequest,
  AIResponseAudit,
  AIResult,
} from "./types";

type AIPromptRow = {
  id: string;
  organisation_id: string | null;
  store_id: string | null;
  job_id: string | null;
  product_id: string | null;
  feature: string;
  provider: string;
  model: string;
  prompt_version: string;
  system_prompt: string | null;
  user_prompt: string | null;
  input: unknown;
  created_at: string;
};

type AIResponseRow = {
  id: string;
  prompt_id: string;
  response: string | null;
  output: unknown;
  finish_reason: string | null;
  prompt_tokens: number | null;
  completion_tokens: number | null;
  total_tokens: number | null;
  latency_ms: number | null;
  estimated_cost: number | string | null;
  model: string | null;
  created_at: string;
};

function isUuid(value?: string) {
  return Boolean(
    value &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        value
      )
  );
}

function mapPrompt(row: AIPromptRow): AIPromptAudit {
  return {
    id: row.id,
    tenantContext:
      row.organisation_id && row.store_id
        ? {
            organisationId: row.organisation_id,
            storeId: row.store_id,
            timezone: "Europe/London",
            currency: "GBP",
            locale: "en-GB",
          }
        : undefined,
    jobId: row.job_id || undefined,
    productId: row.product_id || undefined,
    feature: row.feature,
    provider: row.provider,
    model: row.model,
    promptVersion: row.prompt_version,
    systemPrompt: row.system_prompt || undefined,
    userPrompt: row.user_prompt || undefined,
    input: row.input ?? undefined,
    createdAt: row.created_at,
  };
}

function mapResponse(
  row: AIResponseRow,
  promptsById = new Map<string, AIPromptAudit>()
): AIResponseAudit {
  return {
    id: row.id,
    promptId: row.prompt_id,
    prompt: promptsById.get(row.prompt_id),
    response: row.response || undefined,
    output: row.output ?? undefined,
    finishReason: row.finish_reason || undefined,
    promptTokens: row.prompt_tokens || 0,
    completionTokens: row.completion_tokens || 0,
    totalTokens: row.total_tokens || 0,
    latencyMs: row.latency_ms || 0,
    estimatedCost: Number(row.estimated_cost || 0),
    model: row.model || undefined,
    createdAt: row.created_at,
  };
}

function toJsonCompatible(value: unknown) {
  return JSON.parse(JSON.stringify(value ?? null));
}

async function loadPromptsById(promptIds: string[]) {
  if (promptIds.length === 0) return new Map<string, AIPromptAudit>();

  const { data, error } = await supabaseAdmin
    .from("ai_prompts")
    .select("*")
    .in("id", Array.from(new Set(promptIds)));

  if (error) {
    throw new Error(`Failed to load AI prompts: ${error.message}`);
  }

  return new Map(
    ((data || []) as AIPromptRow[]).map((row) => [row.id, mapPrompt(row)])
  );
}

export async function savePrompt(request: AIRequest): Promise<string> {
  const tenantContext = requireTenantContext(request.tenantContext);
  const input = toJsonCompatible({
    ...(typeof request.input === "object" && request.input !== null
      ? (request.input as Record<string, unknown>)
      : { value: request.input ?? null }),
    templateId: request.templateId,
    templateVersion: request.templateVersion,
    variables: request.variables,
  });

  const { data, error } = await supabaseAdmin
    .from("ai_prompts")
    .insert({
      ...tenantColumns(tenantContext),
      job_id: isUuid(request.jobId) ? request.jobId : null,
      product_id: isUuid(request.productId) ? request.productId : null,
      feature: request.feature,
      provider: "openai",
      model: request.model,
      prompt_version: request.version,
      system_prompt: request.systemPrompt,
      user_prompt: request.userPrompt,
      input,
    })
    .select("id")
    .single<{ id: string }>();

  if (error || !data) {
    throw new Error(
      `Failed to save AI prompt: ${error?.message || "No prompt returned"}`
    );
  }

  return data.id;
}

export async function saveResponse(input: {
  tenantContext?: TenantContext;
  promptId: string;
  result: AIResult;
  model?: string;
}): Promise<string> {
  const { data, error } = await supabaseAdmin
    .from("ai_responses")
    .insert({
      ...(input.tenantContext ? tenantColumns(input.tenantContext) : {}),
      prompt_id: input.promptId,
      response: input.result.text,
      output: toJsonCompatible(input.result.output ?? null),
      finish_reason: input.result.finishReason,
      prompt_tokens: input.result.usage.promptTokens,
      completion_tokens: input.result.usage.completionTokens,
      total_tokens: input.result.usage.totalTokens,
      latency_ms: input.result.usage.latency,
      estimated_cost: input.result.usage.cost,
      model: input.model,
    })
    .select("id")
    .single<{ id: string }>();

  if (error || !data) {
    throw new Error(
      `Failed to save AI response: ${error?.message || "No response returned"}`
    );
  }

  return data.id;
}

export async function getPrompt(
  tenantContext: TenantContext,
  promptId: string
): Promise<AIPromptAudit | null> {
  const { data, error } = await supabaseAdmin
    .from("ai_prompts")
    .select("*")
    .eq("organisation_id", tenantContext.organisationId)
    .eq("store_id", tenantContext.storeId)
    .eq("id", promptId)
    .maybeSingle<AIPromptRow>();

  if (error) {
    throw new Error(`Failed to load AI prompt: ${error.message}`);
  }

  return data ? mapPrompt(data) : null;
}

export async function getResponses(input?: {
  tenantContext?: TenantContext;
  promptId?: string;
  productId?: string;
  jobId?: string;
  limit?: number;
}): Promise<AIResponseAudit[]> {
  const tenantContext = requireTenantContext(input?.tenantContext);
  let promptIds: string[] | undefined;

  if (input?.productId || input?.jobId) {
    let promptQuery = supabaseAdmin
      .from("ai_prompts")
      .select("id")
      .eq("organisation_id", tenantContext.organisationId)
      .eq("store_id", tenantContext.storeId);

    if (input.productId) {
      promptQuery = promptQuery.eq("product_id", input.productId);
    }

    if (input.jobId) {
      promptQuery = promptQuery.eq("job_id", input.jobId);
    }

    const { data, error } = await promptQuery;

    if (error) {
      throw new Error(`Failed to load AI prompt ids: ${error.message}`);
    }

    promptIds = ((data || []) as Array<{ id: string }>).map((row) => row.id);

    if (promptIds.length === 0) return [];
  }

  let responseQuery = supabaseAdmin
    .from("ai_responses")
    .select("*")
    .eq("organisation_id", tenantContext.organisationId)
    .eq("store_id", tenantContext.storeId)
    .order("created_at", { ascending: false })
    .limit(input?.limit ?? 50);

  if (input?.promptId) {
    responseQuery = responseQuery.eq("prompt_id", input.promptId);
  }

  if (promptIds) {
    responseQuery = responseQuery.in("prompt_id", promptIds);
  }

  const { data, error } = await responseQuery;

  if (error) {
    throw new Error(`Failed to load AI responses: ${error.message}`);
  }

  const rows = (data || []) as AIResponseRow[];
  const promptsById = await loadPromptsById(rows.map((row) => row.prompt_id));

  return rows.map((row) => mapResponse(row, promptsById));
}

export async function getCostByDay(
  tenantContext: TenantContext,
  days = 14
): Promise<AICostByDay[]> {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
  const responses = await getResponses({ tenantContext, limit: 1000 });
  const totals = new Map<string, AICostByDay>();

  for (const response of responses) {
    if (response.createdAt < since) continue;

    const day = response.createdAt.slice(0, 10);
    const current = totals.get(day) || {
      day,
      cost: 0,
      tokens: 0,
      calls: 0,
    };

    current.cost += response.estimatedCost;
    current.tokens += response.totalTokens;
    current.calls += 1;

    totals.set(day, current);
  }

  return Array.from(totals.values())
    .map((item) => ({
      ...item,
      cost: Math.round(item.cost * 1_000_000) / 1_000_000,
    }))
    .sort((a, b) => a.day.localeCompare(b.day));
}

export async function getCostByFeature(
  tenantContext: TenantContext,
  days = 30
): Promise<AICostByFeature[]> {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
  const responses = await getResponses({ tenantContext, limit: 1000 });
  const totals = new Map<string, AICostByFeature>();

  for (const response of responses) {
    if (response.createdAt < since) continue;

    const feature = response.prompt?.feature || "UNKNOWN";
    const current = totals.get(feature) || {
      feature,
      cost: 0,
      tokens: 0,
      calls: 0,
    };

    current.cost += response.estimatedCost;
    current.tokens += response.totalTokens;
    current.calls += 1;

    totals.set(feature, current);
  }

  return Array.from(totals.values())
    .map((item) => ({
      ...item,
      cost: Math.round(item.cost * 1_000_000) / 1_000_000,
    }))
    .sort((a, b) => b.cost - a.cost);
}

export async function getAverageLatency(
  tenantContext: TenantContext,
  days = 30
): Promise<number> {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
  const responses = (await getResponses({ tenantContext, limit: 1000 })).filter(
    (response) => response.createdAt >= since
  );

  if (responses.length === 0) return 0;

  const totalLatency = responses.reduce(
    (sum, response) => sum + response.latencyMs,
    0
  );

  return Math.round(totalLatency / responses.length);
}

export async function getMostExpensivePrompt(
  tenantContext: TenantContext
): Promise<AIResponseAudit | null> {
  const { data, error } = await supabaseAdmin
    .from("ai_responses")
    .select("*")
    .eq("organisation_id", tenantContext.organisationId)
    .eq("store_id", tenantContext.storeId)
    .order("estimated_cost", { ascending: false })
    .limit(1)
    .maybeSingle<AIResponseRow>();

  if (error) {
    throw new Error(`Failed to load most expensive prompt: ${error.message}`);
  }

  if (!data) return null;

  const promptsById = await loadPromptsById([data.prompt_id]);

  return mapResponse(data, promptsById);
}
