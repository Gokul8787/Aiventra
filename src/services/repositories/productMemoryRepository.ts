import "server-only";

import type { TenantContext } from "@/context/storeContext";
import { Product } from "@/ai/types/product";
import {
  getProductMemoryKey,
  rememberProduct,
} from "@/ai/memory/memoryEngine";
import {
  ProductMemory,
  ProductMemoryEvent,
  ProductMemoryUpdateOptions,
} from "@/ai/memory/types";
import { supabaseAdmin } from "@/services/supabase/admin";

type ProductMemoryRow = {
  product_key: string;
  provider: string;
  first_seen: string;
  last_seen: string;
  times_seen: number;
  times_recommended: number;
  times_published: number;
  times_sold: number;
  times_retired: number;
  highest_ai_score: number | string;
  lowest_ai_score: number | string;
  average_ai_score: number | string;
  current_supplier: string;
  supplier_changes: number;
  current_price: number | string;
  lowest_price: number | string;
  highest_price: number | string;
  trend_history: Array<number | string> | null;
  confidence_history: Array<number | string> | null;
  current_confidence: number | string;
  decision_history: string[] | null;
  notes: string[] | null;
  memory: Partial<ProductMemory> | null;
  version: string;
};

type ProductMemoryEventRow = {
  id: string;
  event_type: ProductMemoryEvent["type"];
  product_key: string;
  product_id: string | null;
  scan_id: string | null;
  previous_value: unknown;
  value: unknown;
  metadata: Record<string, unknown> | null;
  occurred_at: string;
};

function toNumber(value: number | string | null | undefined) {
  const parsed = Number(value);

  return Number.isFinite(parsed) ? parsed : 0;
}

function toNumberArray(values?: Array<number | string> | null) {
  return (values || []).map(toNumber);
}

function toJson(value: unknown) {
  return JSON.parse(JSON.stringify(value ?? null));
}

function mapMemory(row: ProductMemoryRow): ProductMemory {
  const memory = row.memory || {};

  return {
    productKey: row.product_key,
    provider: row.provider,
    firstSeen: row.first_seen,
    lastSeen: row.last_seen,
    timesSeen: row.times_seen,
    timesRecommended: row.times_recommended,
    timesPublished: row.times_published,
    timesSold: row.times_sold,
    timesRetired: row.times_retired,
    highestAIScore: toNumber(row.highest_ai_score),
    lowestAIScore: toNumber(row.lowest_ai_score),
    averageAIScore: toNumber(row.average_ai_score),
    currentSupplier: row.current_supplier,
    supplierChanges: row.supplier_changes,
    currentPrice: toNumber(row.current_price),
    lowestPrice: toNumber(row.lowest_price),
    highestPrice: toNumber(row.highest_price),
    trendHistory: toNumberArray(row.trend_history),
    confidenceHistory: toNumberArray(row.confidence_history),
    currentConfidence: toNumber(row.current_confidence),
    decisionHistory: row.decision_history || [],
    notes: row.notes || [],
    version: row.version,
    ...memory,
  };
}

function mapEvent(row: ProductMemoryEventRow): ProductMemoryEvent & { id: string } {
  return {
    id: row.id,
    type: row.event_type,
    productKey: row.product_key,
    productDatabaseId: row.product_id || undefined,
    scanId: row.scan_id || undefined,
    previousValue: row.previous_value ?? undefined,
    value: row.value ?? undefined,
    metadata: row.metadata || {},
    occurredAt: row.occurred_at,
  };
}

function memoryRow(tenantContext: TenantContext, memory: ProductMemory) {
  return {
    organisation_id: tenantContext.organisationId,
    store_id: tenantContext.storeId,
    product_key: memory.productKey,
    provider: memory.provider,
    first_seen: memory.firstSeen,
    last_seen: memory.lastSeen,
    times_seen: memory.timesSeen,
    times_recommended: memory.timesRecommended,
    times_published: memory.timesPublished,
    times_sold: memory.timesSold,
    times_retired: memory.timesRetired,
    highest_ai_score: memory.highestAIScore,
    lowest_ai_score: memory.lowestAIScore,
    average_ai_score: memory.averageAIScore,
    current_supplier: memory.currentSupplier,
    supplier_changes: memory.supplierChanges,
    current_price: memory.currentPrice,
    lowest_price: memory.lowestPrice,
    highest_price: memory.highestPrice,
    trend_history: memory.trendHistory,
    confidence_history: memory.confidenceHistory,
    current_confidence: memory.currentConfidence,
    decision_history: memory.decisionHistory,
    notes: memory.notes,
    memory: toJson(memory),
    version: memory.version,
    updated_at: new Date().toISOString(),
  };
}

export async function getProductMemory(input: {
  tenantContext: TenantContext;
  productKey: string;
}): Promise<ProductMemory | null> {
  const { data, error } = await supabaseAdmin
    .from("product_memory")
    .select("*")
    .eq("organisation_id", input.tenantContext.organisationId)
    .eq("store_id", input.tenantContext.storeId)
    .eq("product_key", input.productKey)
    .maybeSingle<ProductMemoryRow>();

  if (error) {
    throw new Error(`Failed to load product memory: ${error.message}`);
  }

  return data ? mapMemory(data) : null;
}

export async function upsertProductMemory(input: {
  tenantContext: TenantContext;
  memory: ProductMemory;
}): Promise<void> {
  const { error } = await supabaseAdmin.from("product_memory").upsert(
    memoryRow(input.tenantContext, input.memory),
    {
      onConflict: "organisation_id,store_id,product_key",
    }
  );

  if (error) {
    throw new Error(`Failed to save product memory: ${error.message}`);
  }
}

export async function saveProductMemoryEvents(input: {
  tenantContext: TenantContext;
  events: ProductMemoryEvent[];
}): Promise<void> {
  if (input.events.length === 0) return;

  const rows = input.events.map((event) => ({
    organisation_id: input.tenantContext.organisationId,
    store_id: input.tenantContext.storeId,
    product_key: event.productKey,
    product_id: event.productDatabaseId || null,
    scan_id: event.scanId || null,
    event_type: event.type,
    previous_value: toJson(event.previousValue),
    value: toJson(event.value),
    metadata: toJson(event.metadata || {}),
    occurred_at: event.occurredAt,
  }));

  const { error } = await supabaseAdmin
    .from("product_memory_events")
    .insert(rows);

  if (error) {
    throw new Error(`Failed to save product memory events: ${error.message}`);
  }
}

export async function saveProductMemoryVersion(input: {
  tenantContext: TenantContext;
  memory: ProductMemory;
  productDatabaseId?: string;
  scanId?: string;
}): Promise<void> {
  const { error } = await supabaseAdmin
    .from("product_memory_versions")
    .insert({
      organisation_id: input.tenantContext.organisationId,
      store_id: input.tenantContext.storeId,
      product_key: input.memory.productKey,
      product_id: input.productDatabaseId || null,
      scan_id: input.scanId || null,
      memory: toJson(input.memory),
      version: input.memory.version,
    });

  if (error) {
    throw new Error(`Failed to save product memory version: ${error.message}`);
  }
}

export async function rememberProductMemory(input: {
  tenantContext: TenantContext;
  product: Product;
  options?: ProductMemoryUpdateOptions;
}): Promise<ProductMemory> {
  const productKey = getProductMemoryKey(input.product);
  const existingMemory = await getProductMemory({
    tenantContext: input.tenantContext,
    productKey,
  });
  const { memory, events } = rememberProduct({
    memory: existingMemory,
    product: input.product,
    options: input.options,
  });

  await upsertProductMemory({
    tenantContext: input.tenantContext,
    memory,
  });

  await saveProductMemoryEvents({
    tenantContext: input.tenantContext,
    events,
  });

  await saveProductMemoryVersion({
    tenantContext: input.tenantContext,
    memory,
    productDatabaseId: input.options?.productDatabaseId,
    scanId: input.options?.scanId,
  });

  return memory;
}

export async function getMemoryForProduct(input: {
  tenantContext: TenantContext;
  product: Product;
}): Promise<ProductMemory | null> {
  return getProductMemory({
    tenantContext: input.tenantContext,
    productKey: getProductMemoryKey(input.product),
  });
}

export async function getProductMemoryEvents(input: {
  tenantContext: TenantContext;
  productKey: string;
  limit?: number;
}) {
  const { data, error } = await supabaseAdmin
    .from("product_memory_events")
    .select("*")
    .eq("organisation_id", input.tenantContext.organisationId)
    .eq("store_id", input.tenantContext.storeId)
    .eq("product_key", input.productKey)
    .order("occurred_at", { ascending: false })
    .limit(input.limit ?? 50);

  if (error) {
    throw new Error(`Failed to load product memory events: ${error.message}`);
  }

  return ((data || []) as ProductMemoryEventRow[]).map(mapEvent);
}

export async function getProductMemoryDashboard(
  tenantContext: TenantContext
): Promise<{
  mostSeen: ProductMemory[];
  mostPublished: ProductMemory[];
  highestConfidence: ProductMemory[];
  fastestGrowing: ProductMemory[];
}> {
  const [mostSeen, mostPublished, highestConfidence, trendCandidates] =
    await Promise.all([
      loadMemoryList(tenantContext, "times_seen", 5),
      loadMemoryList(tenantContext, "times_published", 5),
      loadMemoryList(tenantContext, "current_confidence", 5),
      loadMemoryList(tenantContext, "last_seen", 25),
    ]);

  return {
    mostSeen,
    mostPublished,
    highestConfidence,
    fastestGrowing: [...trendCandidates]
      .sort((a, b) => getTrendGrowth(b) - getTrendGrowth(a))
      .slice(0, 5),
  };
}

async function loadMemoryList(
  tenantContext: TenantContext,
  orderColumn: string,
  limit: number
): Promise<ProductMemory[]> {
  const { data, error } = await supabaseAdmin
    .from("product_memory")
    .select("*")
    .eq("organisation_id", tenantContext.organisationId)
    .eq("store_id", tenantContext.storeId)
    .order(orderColumn, { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(`Failed to load product memory list: ${error.message}`);
  }

  return ((data || []) as ProductMemoryRow[]).map(mapMemory);
}

function getTrendGrowth(memory: ProductMemory) {
  if (memory.trendHistory.length < 2) return 0;

  return (
    memory.trendHistory[memory.trendHistory.length - 1] -
    memory.trendHistory[0]
  );
}
