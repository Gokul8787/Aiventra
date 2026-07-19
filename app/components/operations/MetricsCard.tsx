type MetricsCardProps = {
  label: string;
  value: string;
  hint?: string;
};

export function MetricsCard({ label, value, hint }: MetricsCardProps) {
  return (
    <div className="rounded-xl bg-slate-900 p-5">
      <p className="text-sm text-slate-400">{label}</p>
      <p className="mt-2 text-3xl font-bold text-white">{value}</p>
      {hint ? <p className="mt-2 text-xs text-slate-500">{hint}</p> : null}
    </div>
  );
}
