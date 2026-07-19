"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import type { DeadLetterSnapshot } from "@/operations/types";

type ActionState = Record<string, boolean>;

function statusClass(status: DeadLetterSnapshot["status"]) {
  switch (status) {
    case "resolved":
      return "bg-emerald-500/15 text-emerald-300";
    case "ignored":
      return "bg-slate-700 text-slate-300";
    case "requeued":
      return "bg-cyan-500/15 text-cyan-300";
    default:
      return "bg-amber-500/15 text-amber-300";
  }
}

function extractString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value : undefined;
}

function getRelatedOrderId(item: DeadLetterSnapshot) {
  return (
    extractString(item.payload.orderId) ||
    extractString(item.payload.order_id) ||
    extractString(item.payload.productOrderId)
  );
}

function getRelatedSupplierOrderId(item: DeadLetterSnapshot) {
  return (
    extractString(item.payload.supplierOrderId) ||
    extractString(item.payload.supplier_order_id)
  );
}

async function postAction(url: string) {
  const response = await fetch(url, {
    method: "POST",
  });

  if (!response.ok) {
    const data = (await response.json().catch(() => null)) as
      | { message?: string }
      | null;
    throw new Error(data?.message || "Operation failed.");
  }
}

export function DeadLetterCard({
  items,
}: {
  items: DeadLetterSnapshot[];
}) {
  const router = useRouter();
  const [loading, setLoading] = useState<ActionState>({});
  const [error, setError] = useState<string | null>(null);

  async function runAction(itemId: string, action: "retry" | "resolve" | "ignore") {
    const key = `${itemId}:${action}`;
    setError(null);
    setLoading((current) => ({ ...current, [key]: true }));

    try {
      await postAction(`/api/operations/dead-letter/${itemId}/${action}`);
      router.refresh();
    } catch (actionError) {
      setError(
        actionError instanceof Error ? actionError.message : "Operation failed."
      );
    } finally {
      setLoading((current) => ({ ...current, [key]: false }));
    }
  }

  return (
    <section className="rounded-xl bg-slate-900 p-5 text-white">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h3 className="text-xl font-bold">Dead Letter Queue</h3>
          <p className="mt-1 text-sm text-slate-400">
            Replay, resolve, or ignore failed jobs without touching SQL.
          </p>
        </div>
      </div>

      {error ? (
        <p className="mt-4 rounded-lg bg-red-500/10 p-3 text-sm text-red-200">
          {error}
        </p>
      ) : null}

      <div className="mt-5 space-y-4">
        {items.length === 0 ? (
          <div className="rounded-lg bg-slate-800 p-4 text-sm text-slate-400">
            No dead-letter items for this store.
          </div>
        ) : (
          items.map((item) => {
            const orderId = getRelatedOrderId(item);
            const supplierOrderId = getRelatedSupplierOrderId(item);

            return (
              <div key={item.id} className="rounded-lg bg-slate-800 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold">
                      {item.jobType} · {item.sourceQueue}
                    </p>
                    <p className="mt-1 text-sm text-slate-300">
                      {item.errorMessage || "No error message recorded."}
                    </p>
                  </div>
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-semibold ${statusClass(
                      item.status
                    )}`}
                  >
                    {item.status}
                  </span>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  <ActionButton
                    label="Replay"
                    loading={loading[`${item.id}:retry`] || false}
                    onClick={() => runAction(item.id, "retry")}
                  />
                  <ActionButton
                    label="Resolve"
                    loading={loading[`${item.id}:resolve`] || false}
                    onClick={() => runAction(item.id, "resolve")}
                  />
                  <ActionButton
                    label="Ignore"
                    loading={loading[`${item.id}:ignore`] || false}
                    onClick={() => runAction(item.id, "ignore")}
                  />
                  {orderId ? (
                    <Link
                      href={`/orders/${orderId}`}
                      className="rounded-lg bg-slate-700 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-600"
                    >
                      Open Order
                    </Link>
                  ) : null}
                  {orderId && supplierOrderId ? (
                    <Link
                      href={`/orders/${orderId}?supplierOrderId=${supplierOrderId}`}
                      className="rounded-lg bg-slate-700 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-600"
                    >
                      Open Supplier Order
                    </Link>
                  ) : null}
                </div>

                <p className="mt-3 text-xs text-slate-500">
                  Attempts {item.attemptCount}/{item.maxAttempts} ·{" "}
                  {new Date(item.createdAt).toLocaleString("en-GB")}
                </p>
              </div>
            );
          })
        )}
      </div>
    </section>
  );
}

function ActionButton({
  label,
  loading,
  onClick,
}: {
  label: string;
  loading: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={loading}
      className="rounded-lg bg-cyan-500 px-3 py-2 text-sm font-semibold text-slate-950 transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {loading ? "Working..." : label}
    </button>
  );
}
