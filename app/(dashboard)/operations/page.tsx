import Link from "next/link";

import { requirePageContext } from "@/auth/requirePageContext";
import { getOperationsDashboard } from "@/operations/dashboardService";
import { AlertsCard } from "../../components/operations/AlertsCard";
import { DeadLetterCard } from "../../components/operations/DeadLetterCard";
import { MetricsCard } from "../../components/operations/MetricsCard";
import { ProviderCard } from "../../components/operations/ProviderCard";
import { QueueCard } from "../../components/operations/QueueCard";
import { RecoveryCard } from "../../components/operations/RecoveryCard";
import { WorkerCard } from "../../components/operations/WorkerCard";

export const dynamic = "force-dynamic";

function percent(value: number) {
  return `${value.toFixed(0)}%`;
}

export default async function OperationsPage() {
  const tenantContext = await requirePageContext("jobs.read");
  const dashboard = await getOperationsDashboard(tenantContext);

  return (
    <main className="min-h-screen bg-slate-950 p-6 text-white">
      <section className="mx-auto max-w-7xl">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <Link
              href="/"
              className="text-sm font-semibold text-cyan-400 hover:text-cyan-300"
            >
              ← Back to dashboard
            </Link>
            <p className="mt-6 text-sm font-semibold uppercase tracking-wider text-cyan-400">
              Operations
            </p>
            <h1 className="mt-2 text-3xl font-bold">Platform Health</h1>
            <p className="mt-2 max-w-3xl text-slate-400">
              Queue pressure, worker heartbeats, provider availability, recovery
              flow, and dead-letter controls for {tenantContext.storeName || "this store"}.
            </p>
          </div>

          <div className="rounded-xl bg-slate-900 px-4 py-3 text-sm text-slate-300">
            Updated {new Date(dashboard.generatedAt).toLocaleString("en-GB")}
          </div>
        </div>

        <section className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <MetricsCard
            label="Orders Today"
            value={String(dashboard.metrics.ordersToday)}
            hint="Last 24 hours"
          />
          <MetricsCard
            label="Revenue Today"
            value={`${tenantContext.currency} ${dashboard.metrics.revenueToday.toFixed(2)}`}
          />
          <MetricsCard
            label="Profit Estimate"
            value={`${tenantContext.currency} ${dashboard.metrics.profitEstimateToday.toFixed(2)}`}
          />
          <MetricsCard
            label="AI Cost Today"
            value={`$${dashboard.metrics.aiCostToday.toFixed(4)}`}
          />
          <MetricsCard
            label="Supplier Success"
            value={percent(dashboard.metrics.supplierSuccessRate)}
          />
          <MetricsCard
            label="Fulfilment Success"
            value={percent(dashboard.metrics.fulfilmentSuccessRate)}
          />
          <MetricsCard
            label="Queue Throughput"
            value={`${dashboard.metrics.queueThroughputPerHour}/h`}
          />
          <MetricsCard
            label="Refund Rate"
            value={percent(dashboard.metrics.refundRate)}
          />
        </section>

        <section className="mt-10">
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-2xl font-bold">Queues</h2>
            <Link
              href="/operations/jobs"
              className="text-sm font-semibold text-cyan-400 hover:text-cyan-300"
            >
              View job ledger
            </Link>
          </div>

          <div className="mt-5 grid gap-4 lg:grid-cols-2 2xl:grid-cols-4">
            {Object.values(dashboard.queues).map((queue) => (
              <QueueCard key={queue.key} queue={queue} />
            ))}
          </div>
        </section>

        <section className="mt-10 grid gap-4 xl:grid-cols-[1.3fr_1fr]">
          <RecoveryCard {...dashboard.recovery} />
          <AlertsCard
            alerts={dashboard.alerts.recent}
            openCount={dashboard.alerts.open}
          />
        </section>

        <section className="mt-10">
          <h2 className="text-2xl font-bold">Providers</h2>
          <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {dashboard.providers.providers.map((provider) => (
              <ProviderCard key={provider.id} provider={provider} />
            ))}
          </div>
        </section>

        <section className="mt-10">
          <h2 className="text-2xl font-bold">Workers</h2>
          <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {dashboard.workers.recent.length === 0 ? (
              <div className="rounded-xl bg-slate-900 p-5 text-slate-400">
                No worker heartbeat has been recorded yet.
              </div>
            ) : (
              dashboard.workers.recent.map((worker) => (
                <WorkerCard key={worker.workerKey} worker={worker} />
              ))
            )}
          </div>
        </section>

        <section className="mt-10">
          <DeadLetterCard items={dashboard.deadLetters.items} />
        </section>
      </section>
    </main>
  );
}
