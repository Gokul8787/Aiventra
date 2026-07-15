import { RuleEvaluationContext } from "./types";

export function resolveFieldValue(
  context: RuleEvaluationContext,
  path: string
): unknown {
  const allowedRoots = new Set([
    "product",
    "sales",
    "advertising",
    "inventory",
    "lifecycle",
  ]);

  const parts = path.split(".").filter(Boolean);

  if (parts.length === 0 || !allowedRoots.has(parts[0])) {
    throw new Error(`Unsupported rule field: ${path}`);
  }

  let current: unknown = context;

  for (const part of parts) {
    if (
      current === null ||
      current === undefined ||
      typeof current !== "object"
    ) {
      return undefined;
    }

    current = (current as Record<string, unknown>)[part];
  }

  return current;
}
