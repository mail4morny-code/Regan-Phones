export function StatCard({
  title,
  value,
  detail,
}: {
  title: string;
  value: string;
  detail?: string;
}) {
  return (
    <div className="rounded-2xl border border-black/5 bg-card p-4 shadow-sm sm:p-5 md:p-6">
      <div className="text-xs font-medium text-muted-foreground sm:text-sm">{title}</div>
      <div className="mt-2 break-words text-2xl font-semibold tracking-tight sm:mt-3 sm:text-3xl">{value}</div>
      {detail ? <div className="mt-1 text-xs text-muted-foreground sm:mt-2 sm:text-sm">{detail}</div> : null}
    </div>
  );
}

