type RecoveryCardProps = {
  pending: number;
  checking: number;
  retrying: number;
  manualReview: number;
  completed: number;
  tooLate: number;
};

export function RecoveryCard(props: RecoveryCardProps) {
  return (
    <section className="rounded-xl bg-slate-900 p-5 text-white">
      <h3 className="text-xl font-bold">Recovery Dashboard</h3>
      <p className="mt-1 text-sm text-slate-400">
        Cancellation and fulfilment recovery in one glance.
      </p>

      <div className="mt-5 grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
        <Stat label="Pending" value={String(props.pending)} />
        <Stat label="Checking" value={String(props.checking)} />
        <Stat label="Retrying" value={String(props.retrying)} />
        <Stat label="Manual review" value={String(props.manualReview)} />
        <Stat label="Completed" value={String(props.completed)} />
        <Stat label="Too late" value={String(props.tooLate)} />
      </div>
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-slate-800 p-4">
      <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-bold text-white">{value}</p>
    </div>
  );
}
