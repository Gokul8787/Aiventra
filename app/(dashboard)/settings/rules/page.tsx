import Link from "next/link";
import { requirePageContext } from "@/auth/requirePageContext";
import { listAutomationRules } from "@/services/repositories/rulesRepository";

export const dynamic = "force-dynamic";

export default async function AutomationRulesPage() {
  const tenantContext = await requirePageContext("rules.read");
  const rules = await listAutomationRules(tenantContext);

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
              Automation
            </p>
            <h1 className="mt-2 text-4xl font-bold tracking-tight">
              Rules Engine
            </h1>
            <p className="mt-3 text-slate-300">
              {tenantContext.organisationName || tenantContext.organisationId} ·{" "}
              {tenantContext.storeName || tenantContext.storeId}
            </p>
          </div>

          <div className="rounded-2xl bg-amber-500/10 px-5 py-3 text-sm font-semibold text-amber-200">
            New rules start in DRY_RUN
          </div>
        </div>

        <section className="mt-8 grid gap-5 md:grid-cols-4">
          <Metric label="Rules" value={String(rules.length)} />
          <Metric
            label="Enabled"
            value={String(rules.filter((rule) => rule.enabled).length)}
          />
          <Metric
            label="Dry Run"
            value={String(
              rules.filter((rule) => rule.executionMode === "DRY_RUN").length
            )}
          />
          <Metric
            label="Live"
            value={String(
              rules.filter((rule) => rule.executionMode === "LIVE").length
            )}
          />
        </section>

        <section className="mt-8 space-y-5">
          {rules.map((rule) => (
            <article key={rule.id} className="rounded-2xl bg-slate-900 p-6">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className="flex flex-wrap items-center gap-3">
                    <h2 className="text-2xl font-bold">{rule.name}</h2>
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-semibold ${
                        rule.enabled
                          ? "bg-emerald-500/15 text-emerald-300"
                          : "bg-slate-700 text-slate-300"
                      }`}
                    >
                      {rule.enabled ? "Enabled" : "Disabled"}
                    </span>
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-semibold ${
                        rule.executionMode === "LIVE"
                          ? "bg-red-500/15 text-red-300"
                          : "bg-amber-500/15 text-amber-300"
                      }`}
                    >
                      {rule.executionMode}
                    </span>
                  </div>

                  {rule.description && (
                    <p className="mt-2 text-sm text-slate-400">
                      {rule.description}
                    </p>
                  )}
                </div>

                <div className="grid grid-cols-3 gap-3 text-center text-sm">
                  <Mini label="Priority" value={String(rule.priority)} />
                  <Mini label="Matched" value={String(rule.matchCount)} />
                  <Mini label="Failed" value={String(rule.failureCount)} />
                </div>
              </div>

              <div className="mt-6 grid gap-5 lg:grid-cols-2">
                <div className="rounded-xl bg-slate-800 p-4">
                  <p className="font-semibold">
                    Conditions ({rule.logicalOperator})
                  </p>
                  <div className="mt-3 space-y-2">
                    {rule.conditions.map((condition, index) => (
                      <CodeLine
                        key={`${rule.id}-condition-${index}`}
                        value={`${condition.field} ${condition.operator} ${formatValue(
                          condition.value
                        )}`}
                      />
                    ))}
                  </div>
                </div>

                <div className="rounded-xl bg-slate-800 p-4">
                  <p className="font-semibold">Actions</p>
                  <div className="mt-3 space-y-2">
                    {rule.actions.map((action, index) => (
                      <CodeLine
                        key={`${rule.id}-action-${index}`}
                        value={`${action.type} ${formatValue(action.payload)}`}
                      />
                    ))}
                  </div>
                </div>
              </div>

              <div className="mt-4 text-sm text-slate-400">
                Last matched:{" "}
                {rule.lastMatchedAt
                  ? new Date(rule.lastMatchedAt).toLocaleString("en-GB")
                  : "Never"}
              </div>
            </article>
          ))}

          {rules.length === 0 && (
            <div className="rounded-2xl bg-slate-900 p-6 text-slate-400">
              No automation rules have been created yet.
            </div>
          )}
        </section>
      </section>
    </main>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-slate-900 p-5">
      <p className="text-sm text-slate-400">{label}</p>
      <p className="mt-2 text-3xl font-bold">{value}</p>
    </div>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-slate-800 px-4 py-3">
      <p className="text-xs text-slate-400">{label}</p>
      <p className="mt-1 font-bold">{value}</p>
    </div>
  );
}

function CodeLine({ value }: { value: string }) {
  return (
    <div className="rounded-lg bg-slate-900 px-3 py-2 font-mono text-xs text-slate-300">
      {value}
    </div>
  );
}

function formatValue(value: unknown) {
  if (value === undefined) return "";
  if (typeof value === "string") return value;

  return JSON.stringify(value);
}
