import Link from "next/link";
import { requirePageContext } from "@/auth/requirePageContext";
import { getJobOperationsSnapshot } from "@/services/repositories/backgroundJobRepository";

export const dynamic = "force-dynamic";

export default async function OperationsJobsPage() {
  const tenantContext = await requirePageContext("jobs.read");
  const snapshot = await getJobOperationsSnapshot(tenantContext);

  return (
    <main className="min-h-screen bg-slate-950 p-6 text-white">
      <section className="mx-auto max-w-7xl">
        <Link
          href="/"
          className="text-sm font-semibold text-cyan-400 hover:text-cyan-300"
        >
          ← Back to dashboard
        </Link>

        <div className="mt-6">
          <p className="text-sm font-semibold uppercase tracking-wider text-cyan-400">
            Operations
          </p>
          <h1 className="mt-2 text-3xl font-bold">Background Jobs</h1>
          <p className="mt-2 text-slate-400">
            Durable queue progress, attempts, stale workers and dead-letter
            visibility for this store.
          </p>
        </div>

        <section className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Summary label="Queued" value={String(snapshot.counts.queued)} />
          <Summary label="Running" value={String(snapshot.counts.running)} />
          <Summary label="Retrying" value={String(snapshot.counts.retrying)} />
          <Summary
            label="Dead letter"
            value={String(snapshot.counts.dead_letter)}
          />
          <Summary label="Failed" value={String(snapshot.counts.failed)} />
          <Summary
            label="Cancelled"
            value={String(snapshot.counts.cancelled)}
          />
          <Summary
            label="Completed"
            value={String(snapshot.counts.completed)}
          />
          <Summary label="Stale" value={String(snapshot.staleCount)} />
        </section>

        <section className="mt-8 rounded-2xl bg-slate-900 p-6">
          <h2 className="text-2xl font-bold">Latest Jobs</h2>

          <div className="mt-6 space-y-4">
            {snapshot.jobs.length === 0 ? (
              <div className="rounded-xl bg-slate-800 p-5 text-slate-400">
                No jobs have been recorded yet.
              </div>
            ) : (
              snapshot.jobs.map((job) => (
                <div key={job.id} className="rounded-xl bg-slate-800 p-5">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <p className="font-semibold">
                        {job.jobType || "UNKNOWN"} · {job.queueName || "no queue"}
                      </p>
                      <p className="mt-1 text-sm text-slate-400">{job.id}</p>
                    </div>

                    <span
                      className={`rounded-full px-3 py-1 text-xs font-semibold ${statusClass(
                        job.status
                      )}`}
                    >
                      {job.status}
                    </span>
                  </div>

                  <div className="mt-4 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-5">
                    <InlineStat label="Progress" value={`${job.progress}%`} />
                    <InlineStat
                      label="Step"
                      value={job.currentStep || "Unknown"}
                    />
                    <InlineStat
                      label="Attempt"
                      value={`${job.attemptCount}/${job.maxAttempts}`}
                    />
                    <InlineStat
                      label="Worker"
                      value={job.workerId || "Unclaimed"}
                    />
                    <InlineStat
                      label="Heartbeat"
                      value={
                        job.heartbeatAt
                          ? new Date(job.heartbeatAt).toLocaleString("en-GB")
                          : "None"
                      }
                    />
                  </div>

                  {job.errorMessage && (
                    <p className="mt-4 rounded-lg bg-red-500/10 p-3 text-sm text-red-200">
                      {job.errorMessage}
                    </p>
                  )}
                </div>
              ))
            )}
          </div>
        </section>
      </section>
    </main>
  );
}

function Summary({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-slate-900 p-5">
      <p className="text-sm text-slate-400">{label}</p>
      <p className="mt-2 text-3xl font-bold">{value}</p>
    </div>
  );
}

function InlineStat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 font-semibold">{value}</p>
    </div>
  );
}

function statusClass(status: string) {
  switch (status) {
    case "completed":
      return "bg-emerald-500/15 text-emerald-300";
    case "running":
      return "bg-blue-500/15 text-blue-300";
    case "retrying":
    case "queued":
      return "bg-amber-500/15 text-amber-300";
    case "dead_letter":
    case "failed":
      return "bg-red-500/15 text-red-300";
    default:
      return "bg-slate-700 text-slate-300";
  }
}
