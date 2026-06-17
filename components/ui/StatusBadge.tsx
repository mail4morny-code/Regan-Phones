import { formatPhoneStatus } from "@/lib/format/display";

export function StatusBadge({ status }: { status: string }) {
  const normalized = (status ?? "").toString();

  const styles: Record<string, string> = {
    Available:
      "border bg-foreground/5 text-foreground/90",
    Sold:
      "border border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
    "With Dealer":
      "border border-blue-500/30 bg-blue-500/10 text-blue-700 dark:text-blue-300",
    Returned:
      "border border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300",
    Damaged:
      "border border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-300",
    Archived:
      "border border-gray-500/30 bg-gray-500/10 text-gray-700",
  };

  return (
    <span
      className={
        "inline-flex items-center justify-center rounded-full px-3 py-1 text-xs font-semibold " +
        (styles[normalized] ?? "border bg-foreground/5 text-foreground/90")

      }
    >
      {formatPhoneStatus(status)}
    </span>
  );
}

