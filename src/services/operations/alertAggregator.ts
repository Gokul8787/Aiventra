import type {
  DeadLetterSnapshot,
  OperationsAlertSnapshot,
  RecoverySnapshot,
} from "@/operations/types";
import type { OperationsAlertSeverity } from "@/recovery/types";

export function buildAlertsSummary(alerts: OperationsAlertSnapshot[]) {
  const summary = {
    info: 0,
    warning: 0,
    critical: 0,
  } satisfies Record<OperationsAlertSeverity, number>;

  for (const alert of alerts) {
    summary[alert.severity] += 1;
  }

  return {
    summary,
    open: alerts.filter((alert) => alert.status === "open").length,
    recent: alerts,
  };
}

export function buildDeadLetterSummary(items: DeadLetterSnapshot[]) {
  return {
    open: items.filter((item) => item.status === "open").length,
    retrying: items.filter((item) => item.status === "requeued").length,
    resolved: items.filter((item) => item.status === "resolved").length,
    ignored: items.filter((item) => item.status === "ignored").length,
    items,
  };
}

export function buildRecoverySummary(requests: RecoverySnapshot[]) {
  return {
    pending: requests.filter((item) => item.status === "requested").length,
    checking: requests.filter((item) => item.status === "checking").length,
    retrying: requests.filter((item) => Boolean(item.nextRetryAt)).length,
    manualReview: requests.filter((item) => item.status === "review_required")
      .length,
    completed: requests.filter((item) => item.status === "completed").length,
    tooLate: requests.filter((item) => item.decision === "TOO_LATE").length,
    recent: requests,
  };
}
