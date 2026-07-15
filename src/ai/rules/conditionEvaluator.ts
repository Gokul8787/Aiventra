import {
  RuleCondition,
  RuleConditionResult,
  RuleEvaluationContext,
} from "./types";
import { resolveFieldValue } from "./fieldResolver";

function compareNumbers(
  actual: unknown,
  expected: unknown,
  comparator: (actualNumber: number, expectedNumber: number) => boolean
): boolean {
  const actualNumber = Number(actual);
  const expectedNumber = Number(expected);

  if (!Number.isFinite(actualNumber) || !Number.isFinite(expectedNumber)) {
    return false;
  }

  return comparator(actualNumber, expectedNumber);
}

export function evaluateCondition(
  context: RuleEvaluationContext,
  condition: RuleCondition
): RuleConditionResult {
  const actualValue = resolveFieldValue(context, condition.field);

  let matched = false;

  switch (condition.operator) {
    case "eq":
      matched = actualValue === condition.value;
      break;

    case "neq":
      matched = actualValue !== condition.value;
      break;

    case "gt":
      matched = compareNumbers(
        actualValue,
        condition.value,
        (actual, expected) => actual > expected
      );
      break;

    case "gte":
      matched = compareNumbers(
        actualValue,
        condition.value,
        (actual, expected) => actual >= expected
      );
      break;

    case "lt":
      matched = compareNumbers(
        actualValue,
        condition.value,
        (actual, expected) => actual < expected
      );
      break;

    case "lte":
      matched = compareNumbers(
        actualValue,
        condition.value,
        (actual, expected) => actual <= expected
      );
      break;

    case "in":
      matched =
        Array.isArray(condition.value) && condition.value.includes(actualValue);
      break;

    case "not_in":
      matched =
        Array.isArray(condition.value) && !condition.value.includes(actualValue);
      break;

    case "exists":
      matched = actualValue !== undefined && actualValue !== null;
      break;

    case "not_exists":
      matched = actualValue === undefined || actualValue === null;
      break;

    default:
      matched = false;
  }

  return {
    condition,
    actualValue,
    matched,
    reason: matched
      ? `${condition.field} matched ${condition.operator}.`
      : `${condition.field} did not match ${condition.operator}.`,
  };
}
