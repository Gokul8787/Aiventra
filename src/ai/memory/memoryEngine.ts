import { Product } from "@/ai/types/product";
import {
  ProductMemory,
  ProductMemoryEvent,
  ProductMemoryUpdateOptions,
} from "./types";

const MEMORY_VERSION = "1.0.0";
const HISTORY_LIMIT = 100;

function round(value: number) {
  return Math.round(value * 100) / 100;
}

function compactHistory(values: number[]) {
  return values.slice(-HISTORY_LIMIT);
}

function compactTextHistory(values: string[]) {
  return values.slice(-HISTORY_LIMIT);
}

function normalizePart(value?: string) {
  return (value || "unknown")
    .trim()
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function getProductMemoryKey(product: Product) {
  return [
    normalizePart(product.provider || product.supplier),
    normalizePart(product.supplier),
    normalizePart(product.name),
  ].join(":");
}

function getConfidence(product: Product) {
  return (
    product.intelligence?.confidence?.confidenceScore ||
    product.decision?.confidence ||
    product.aiScore ||
    0
  );
}

function getDecision(product: Product) {
  return (
    product.decision?.decision ||
    product.currentLifecycle ||
    (product.aiScore > 0 ? "SCORED" : "DISCOVERED")
  );
}

function createInitialMemory(product: Product, now: string): ProductMemory {
  const aiScore = product.aiScore || 0;
  const price = product.supplierPrice || 0;
  const confidence = getConfidence(product);

  return {
    productKey: getProductMemoryKey(product),
    provider: product.provider || product.supplier || "unknown",
    firstSeen: now,
    lastSeen: now,
    timesSeen: 0,
    timesRecommended: 0,
    timesPublished: 0,
    timesSold: 0,
    timesRetired: 0,
    highestAIScore: aiScore,
    lowestAIScore: aiScore,
    averageAIScore: aiScore,
    currentSupplier: product.supplier,
    supplierChanges: 0,
    currentPrice: price,
    lowestPrice: price,
    highestPrice: price,
    trendHistory: [],
    confidenceHistory: [],
    currentConfidence: confidence,
    decisionHistory: [],
    notes: [],
    version: MEMORY_VERSION,
  };
}

function calculateAverage(previousAverage: number, previousCount: number, value: number) {
  if (previousCount <= 0) return value;

  return round((previousAverage * previousCount + value) / (previousCount + 1));
}

function addEvent(events: ProductMemoryEvent[], event: ProductMemoryEvent) {
  events.push(event);
}

export function rememberProduct(input: {
  memory?: ProductMemory | null;
  product: Product;
  options?: ProductMemoryUpdateOptions;
}): {
  memory: ProductMemory;
  events: ProductMemoryEvent[];
} {
  const now = new Date().toISOString();
  const existingMemory = loadMemory(input.memory);
  const productKey = getProductMemoryKey(input.product);
  const memory = existingMemory
    ? updateMemory({
        ...existingMemory,
        productKey,
      })
    : createInitialMemory(input.product, now);
  const events: ProductMemoryEvent[] = [];
  const previousSeenCount = memory.timesSeen;
  const aiScore = input.product.aiScore || 0;
  const supplier = input.product.supplier || "unknown";
  const price = input.product.supplierPrice || 0;
  const trendScore = input.product.trendScore || 0;
  const confidence = getConfidence(input.product);
  const decision = getDecision(input.product);
  const lastTrendScore = memory.trendHistory[memory.trendHistory.length - 1];
  const lastConfidence =
    memory.confidenceHistory[memory.confidenceHistory.length - 1];
  const lastDecision = memory.decisionHistory[memory.decisionHistory.length - 1];

  memory.productKey = productKey;
  memory.provider = input.product.provider || input.product.supplier || "unknown";
  memory.lastSeen = now;
  memory.timesSeen += 1;
  memory.highestAIScore = Math.max(memory.highestAIScore, aiScore);
  memory.lowestAIScore =
    previousSeenCount === 0 ? aiScore : Math.min(memory.lowestAIScore, aiScore);
  memory.averageAIScore = calculateAverage(
    memory.averageAIScore,
    previousSeenCount,
    aiScore
  );
  memory.trendHistory = compactHistory([...memory.trendHistory, trendScore]);
  memory.confidenceHistory = compactHistory([
    ...memory.confidenceHistory,
    confidence,
  ]);
  memory.currentConfidence = confidence;
  memory.decisionHistory = compactTextHistory([
    ...memory.decisionHistory,
    decision,
  ]);

  addEvent(events, {
    type: "SEEN",
    productKey,
    productDatabaseId: input.options?.productDatabaseId,
    scanId: input.options?.scanId,
    value: memory.timesSeen,
    metadata: {
      aiScore,
      trendScore,
      confidence,
      decision,
    },
    occurredAt: now,
  });

  if (input.options?.recommended) {
    memory.timesRecommended += 1;
    addEvent(events, {
      type: "RECOMMENDED",
      productKey,
      productDatabaseId: input.options.productDatabaseId,
      scanId: input.options.scanId,
      value: memory.timesRecommended,
      occurredAt: now,
    });
  }

  if (input.options?.published) {
    memory.timesPublished += 1;
    addEvent(events, {
      type: "PUBLISHED",
      productKey,
      productDatabaseId: input.options.productDatabaseId,
      scanId: input.options.scanId,
      value: memory.timesPublished,
      occurredAt: now,
    });
  }

  if (input.options?.soldQuantity && input.options.soldQuantity > 0) {
    memory.timesSold += input.options.soldQuantity;
    addEvent(events, {
      type: "SOLD",
      productKey,
      productDatabaseId: input.options.productDatabaseId,
      scanId: input.options.scanId,
      value: input.options.soldQuantity,
      occurredAt: now,
    });
  }

  if (input.options?.retired || input.product.currentLifecycle === "RETIRED") {
    memory.timesRetired += 1;
    addEvent(events, {
      type: "RETIRED",
      productKey,
      productDatabaseId: input.options?.productDatabaseId,
      scanId: input.options?.scanId,
      value: memory.timesRetired,
      occurredAt: now,
    });
  }

  if (memory.currentSupplier && memory.currentSupplier !== supplier) {
    addEvent(events, {
      type: "SUPPLIER_CHANGED",
      productKey,
      productDatabaseId: input.options?.productDatabaseId,
      scanId: input.options?.scanId,
      previousValue: memory.currentSupplier,
      value: supplier,
      occurredAt: now,
    });

    memory.supplierChanges += 1;
  }

  memory.currentSupplier = supplier;

  if (memory.currentPrice !== price) {
    addEvent(events, {
      type: "PRICE_CHANGED",
      productKey,
      productDatabaseId: input.options?.productDatabaseId,
      scanId: input.options?.scanId,
      previousValue: memory.currentPrice,
      value: price,
      occurredAt: now,
    });
  }

  memory.currentPrice = price;
  memory.lowestPrice =
    previousSeenCount === 0 ? price : Math.min(memory.lowestPrice, price);
  memory.highestPrice =
    previousSeenCount === 0 ? price : Math.max(memory.highestPrice, price);

  if (lastTrendScore !== undefined && lastTrendScore !== trendScore) {
    addEvent(events, {
      type: "TREND_CHANGED",
      productKey,
      productDatabaseId: input.options?.productDatabaseId,
      scanId: input.options?.scanId,
      previousValue: lastTrendScore,
      value: trendScore,
      occurredAt: now,
    });
  }

  if (lastConfidence !== undefined && lastConfidence !== confidence) {
    addEvent(events, {
      type: "CONFIDENCE_CHANGED",
      productKey,
      productDatabaseId: input.options?.productDatabaseId,
      scanId: input.options?.scanId,
      previousValue: lastConfidence,
      value: confidence,
      occurredAt: now,
    });
  }

  if (lastDecision !== undefined && lastDecision !== decision) {
    addEvent(events, {
      type: "DECISION_CHANGED",
      productKey,
      productDatabaseId: input.options?.productDatabaseId,
      scanId: input.options?.scanId,
      previousValue: lastDecision,
      value: decision,
      occurredAt: now,
    });
  }

  for (const note of input.options?.notes || []) {
    memory.notes = compactTextHistory([...memory.notes, note]);
    addEvent(events, {
      type: "NOTE_ADDED",
      productKey,
      productDatabaseId: input.options?.productDatabaseId,
      scanId: input.options?.scanId,
      value: note,
      occurredAt: now,
    });
  }

  memory.version = MEMORY_VERSION;

  return {
    memory: updateMemory(memory),
    events,
  };
}

export function loadMemory(memory?: ProductMemory | null): ProductMemory | null {
  return memory ? updateMemory(memory) : null;
}

export function updateMemory(memory: ProductMemory): ProductMemory {
  return {
    ...memory,
    highestAIScore: round(memory.highestAIScore),
    lowestAIScore: round(memory.lowestAIScore),
    averageAIScore: round(memory.averageAIScore),
    currentPrice: round(memory.currentPrice),
    lowestPrice: round(memory.lowestPrice),
    highestPrice: round(memory.highestPrice),
    currentConfidence: round(memory.currentConfidence),
    trendHistory: compactHistory(memory.trendHistory.map(round)),
    confidenceHistory: compactHistory(memory.confidenceHistory.map(round)),
    decisionHistory: compactTextHistory(memory.decisionHistory),
    notes: compactTextHistory(memory.notes),
    version: memory.version || MEMORY_VERSION,
  };
}

export function mergeMemory(
  current: ProductMemory,
  incoming: ProductMemory
): ProductMemory {
  return updateMemory({
    ...current,
    ...incoming,
    firstSeen: current.firstSeen || incoming.firstSeen,
    timesSeen: Math.max(current.timesSeen || 0, incoming.timesSeen || 0),
    timesRecommended: Math.max(
      current.timesRecommended || 0,
      incoming.timesRecommended || 0
    ),
    timesPublished: Math.max(
      current.timesPublished || 0,
      incoming.timesPublished || 0
    ),
    timesSold: Math.max(current.timesSold || 0, incoming.timesSold || 0),
    timesRetired: Math.max(
      current.timesRetired || 0,
      incoming.timesRetired || 0
    ),
    trendHistory: compactHistory([
      ...(current.trendHistory || []),
      ...(incoming.trendHistory || []),
    ]),
    confidenceHistory: compactHistory([
      ...(current.confidenceHistory || []),
      ...(incoming.confidenceHistory || []),
    ]),
    decisionHistory: compactTextHistory([
      ...(current.decisionHistory || []),
      ...(incoming.decisionHistory || []),
    ]),
    notes: compactTextHistory([...(current.notes || []), ...(incoming.notes || [])]),
  });
}
