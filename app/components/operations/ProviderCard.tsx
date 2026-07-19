import type { ProviderSnapshot } from "@/operations/types";

function statusClass(status: ProviderSnapshot["status"]) {
  switch (status) {
    case "healthy":
      return "bg-emerald-500/15 text-emerald-300";
    case "warning":
      return "bg-amber-500/15 text-amber-300";
    case "critical":
      return "bg-red-500/15 text-red-300";
    default:
      return "bg-slate-700 text-slate-300";
  }
}

export function ProviderCard({ provider }: { provider: ProviderSnapshot }) {
  return (
    <div className="rounded-xl bg-slate-900 p-5 text-white">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="font-semibold">{provider.name}</p>
          <p className="mt-1 text-sm text-slate-400">
            {provider.categories.length
              ? provider.categories.join(", ")
              : "No recent samples"}
          </p>
        </div>
        <span
          className={`rounded-full px-3 py-1 text-xs font-semibold ${statusClass(
            provider.status
          )}`}
        >
          {provider.status}
        </span>
      </div>

      <div className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
        <Stat
          label="Latency"
          value={provider.latencyMs ? `${provider.latencyMs} ms` : "Unknown"}
        />
        <Stat
          label="Availability"
          value={`${provider.availability.toFixed(0)}%`}
        />
        <Stat
          label="Quota"
          value={
            typeof provider.quotaRemaining === "number"
              ? provider.quotaRemaining.toFixed(0)
              : "n/a"
          }
        />
        <Stat
          label="API points"
          value={
            typeof provider.apiPointsRemaining === "number"
              ? provider.apiPointsRemaining.toFixed(0)
              : "n/a"
          }
        />
      </div>

      {provider.message ? (
        <p className="mt-4 text-sm text-slate-300">{provider.message}</p>
      ) : null}
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
