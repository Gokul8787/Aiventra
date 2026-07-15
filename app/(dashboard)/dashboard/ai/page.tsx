import Link from "next/link";
import { requirePageContext } from "@/auth/requirePageContext";
import {
  getAverageLatency,
  getCostByDay,
  getCostByFeature,
  getMostExpensivePrompt,
  getResponses,
} from "@/services/aiAudit/AIAuditRepository";

export const dynamic = "force-dynamic";

export default async function AIAnalyticsPage() {
  const tenantContext = await requirePageContext("audit.read");
  const [costByDay, costByFeature, averageLatency, mostExpensive, recent] =
    await Promise.all([
      getCostByDay(tenantContext, 14),
      getCostByFeature(tenantContext, 30),
      getAverageLatency(tenantContext, 30),
      getMostExpensivePrompt(tenantContext),
      getResponses({ tenantContext, limit: 25 }),
    ]);

  const today = new Date().toISOString().slice(0, 10);
  const todayCost =
    costByDay.find((item) => item.day === today)?.cost || 0;
  const todayTokens =
    costByDay.find((item) => item.day === today)?.tokens || 0;
  const mostUsed = [...costByFeature].sort((a, b) => b.calls - a.calls)[0];
  const totalCalls = costByFeature.reduce((sum, item) => sum + item.calls, 0);

  return (
    <main className="min-h-screen bg-slate-950 p-6 text-white">
      <section className="mx-auto max-w-7xl">
        <Link
          href="/"
          className="text-sm font-semibold text-cyan-400 hover:text-cyan-300"
        >
          ← Back to dashboard
        </Link>

        <div className="mt-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wider text-cyan-400">
              Aiventra Operations
            </p>
            <h1 className="mt-2 text-4xl font-bold tracking-tight">
              AI Analytics
            </h1>
            <p className="mt-3 text-slate-300">
              Prompt usage, token volume, latency and estimated OpenAI cost.
            </p>
            <p className="mt-2 text-sm text-slate-400">
              {tenantContext.organisationName || tenantContext.organisationId} ·{" "}
              {tenantContext.storeName || tenantContext.storeId}
            </p>
          </div>
        </div>

        <section className="mt-8 grid gap-5 md:grid-cols-3 lg:grid-cols-5">
          <Metric label="Today's Cost" value={`$${todayCost.toFixed(6)}`} />
          <Metric
            label="Today's Tokens"
            value={todayTokens.toLocaleString("en-GB")}
          />
          <Metric
            label="Average Latency"
            value={`${(averageLatency / 1000).toFixed(2)}s`}
          />
          <Metric
            label="Most Expensive Prompt"
            value={mostExpensive?.prompt?.feature || "None"}
          />
          <Metric label="Most Used Prompt" value={mostUsed?.feature || "None"} />
        </section>

        <section className="mt-8 rounded-2xl bg-slate-900 p-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-2xl font-bold">Cost By Feature</h2>
              <p className="mt-1 text-sm text-slate-400">
                Last 30 days · {totalCalls} audited calls
              </p>
            </div>
          </div>

          <div className="mt-6 overflow-x-auto">
            <table className="w-full min-w-[680px] text-left text-sm">
              <thead className="text-slate-400">
                <tr>
                  <th className="pb-3">Feature</th>
                  <th className="pb-3">Calls</th>
                  <th className="pb-3">Tokens</th>
                  <th className="pb-3">Cost</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {costByFeature.map((item) => (
                  <tr key={item.feature}>
                    <td className="py-4 font-semibold">{item.feature}</td>
                    <td className="py-4">{item.calls}</td>
                    <td className="py-4">
                      {item.tokens.toLocaleString("en-GB")}
                    </td>
                    <td className="py-4">${item.cost.toFixed(6)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {costByFeature.length === 0 && (
              <Empty text="No AI audit data has been recorded yet." />
            )}
          </div>
        </section>

        <section className="mt-8 rounded-2xl bg-slate-900 p-6">
          <h2 className="text-2xl font-bold">Recent AI Calls</h2>

          <div className="mt-6 space-y-4">
            {recent.map((item) => (
              <div key={item.id} className="rounded-xl bg-slate-800 p-4">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="font-semibold">
                      {item.prompt?.feature || "Unknown feature"}
                    </p>
                    <p className="mt-1 text-sm text-slate-400">
                      v{item.prompt?.promptVersion || "unknown"} ·{" "}
                      {item.model || item.prompt?.model || "unknown model"} ·{" "}
                      {item.finishReason || "unknown"}
                    </p>
                  </div>

                  <div className="text-right text-sm text-slate-400">
                    <p>{new Date(item.createdAt).toLocaleString("en-GB")}</p>
                    <p>
                      {item.totalTokens.toLocaleString("en-GB")} tokens · $
                      {item.estimatedCost.toFixed(6)}
                    </p>
                    <p>{item.latencyMs}ms</p>
                  </div>
                </div>

                <p className="mt-4 line-clamp-3 text-sm text-slate-300">
                  {item.response || "No text response saved."}
                </p>
              </div>
            ))}

            {recent.length === 0 && (
              <Empty text="No AI calls have been logged yet." />
            )}
          </div>
        </section>
      </section>
    </main>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-slate-900 p-5">
      <p className="text-sm text-slate-400">{label}</p>
      <p className="mt-2 break-words text-2xl font-bold">{value}</p>
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <div className="rounded-xl bg-slate-800 p-5 text-sm text-slate-400">
      {text}
    </div>
  );
}
