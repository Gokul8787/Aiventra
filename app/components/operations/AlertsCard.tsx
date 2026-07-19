import type { OperationsAlertSnapshot } from "@/operations/types";

function severityClass(severity: OperationsAlertSnapshot["severity"]) {
  switch (severity) {
    case "critical":
      return "bg-red-500/15 text-red-300";
    case "warning":
      return "bg-amber-500/15 text-amber-300";
    default:
      return "bg-cyan-500/15 text-cyan-300";
  }
}

export function AlertsCard({
  alerts,
  openCount,
}: {
  alerts: OperationsAlertSnapshot[];
  openCount: number;
}) {
  return (
    <section className="rounded-xl bg-slate-900 p-5 text-white">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h3 className="text-xl font-bold">Operations Alerts</h3>
          <p className="mt-1 text-sm text-slate-400">
            Open alerts: {openCount}
          </p>
        </div>
      </div>

      <div className="mt-5 space-y-3">
        {alerts.length === 0 ? (
          <div className="rounded-lg bg-slate-800 p-4 text-sm text-slate-400">
            No alerts are open right now.
          </div>
        ) : (
          alerts.map((alert) => (
            <div key={alert.id} className="rounded-lg bg-slate-800 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold">{alert.title}</p>
                  <p className="mt-1 text-sm text-slate-300">{alert.message}</p>
                </div>
                <span
                  className={`rounded-full px-3 py-1 text-xs font-semibold ${severityClass(
                    alert.severity
                  )}`}
                >
                  {alert.severity}
                </span>
              </div>
              <p className="mt-3 text-xs text-slate-500">
                {alert.category} · {new Date(alert.createdAt).toLocaleString("en-GB")}
              </p>
            </div>
          ))
        )}
      </div>
    </section>
  );
}
