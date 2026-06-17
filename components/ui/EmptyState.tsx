export function EmptyState({
  title = "Nothing here yet",
  description,
}: {
  title?: string;
  description?: string;
}) {
  return (
    <div className="rounded-lg border border-dashed bg-card p-4 text-sm text-muted-foreground sm:p-6">
      <div className="font-semibold text-foreground">{title}</div>
      {description ? <div className="mt-1">{description}</div> : null}
    </div>
  );
}

