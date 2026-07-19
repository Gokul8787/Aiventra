import type { WorkerSnapshot } from "@/operations/types";

function statusClass(status: WorkerSnapshot["status"]) {
  switch (status) {
    case "healthy":
      return "bg-emerald-500/15 text-emerald-300";
    case "warning":
      return "bg-amber-500/15 text-amber-300";
    default:
      return "bg-red-500/15 text-red-300";
  }
}

export function WorkerCard({ worker }: { worker: WorkerSnapshot }) {
  return (
    <div className="rounded-xl bg-slate-900 p-5 text-white">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="font-semibold">{worker.workerId}</p>
          <p className="mt-1 text-sm text-slate-400">{worker.queueName}</p>
        </div>
        <span
          className={`rounded-full px-3 py-1 text-xs font-semibold ${statusClass(
            worker.status
          )}`}
        >
          {worker.status}
        </span>
      </div>

      <div className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
        <Stat label="Heartbeat" value={new Date(worker.heartbeatAt).toLocaleString("en-GB")} />
        <Stat label="Version" value={worker.version} />
        <Stat label="Host" value={worker.host || "Unknown"} />
        <Stat
          label="Memory"
          value={
            typeof worker.memoryMb === "number"
              ? `${worker.memoryMb.toFixed(1)} MB`
              : "Unknown"
          }
        />
      </div>
    </div>
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
