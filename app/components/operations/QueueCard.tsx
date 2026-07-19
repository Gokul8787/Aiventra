import type { OperationsQueueSnapshot } from "@/operations/types";

function formatAge(seconds: number) {
  if (!seconds) return "Fresh";
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  return `${Math.floor(seconds / 3600)}h`;
}

export function QueueCard({ queue }: { queue: OperationsQueueSnapshot }) {
  return (
    <section className="rounded-xl bg-slate-900 p-5 text-white">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-cyan-400">
            {queue.label}
          </p>
          <h3 className="mt-2 text-xl font-bold">{queue.queueName}</h3>
        </div>
        <div className="rounded-full bg-slate-800 px-3 py-1 text-xs font-semibold text-slate-300">
          Active {queue.active}
        </div>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3 text-sm text-slate-300">
        <Stat label="Queued" value={String(queue.counts.queued)} />
        <Stat label="Running" value={String(queue.counts.running)} />
        <Stat label="Retrying" value={String(queue.counts.retrying)} />
        <Stat label="Dead letter" value={String(queue.counts.dead_letter)} />
        <Stat label="Oldest age" value={formatAge(queue.oldestMessageAgeSeconds)} />
        <Stat label="Msg / hour" value={String(queue.messagesPerHour)} />
        <Stat
          label="Fail / hour"
          value={String(queue.failuresPerHour)}
        />
        <Stat label="Stale jobs" value={String(queue.staleJobs)} />
      </div>
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 font-semibold text-white">{value}</p>
    </div>
  );
}
