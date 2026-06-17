import { ReactNode } from "react";
import Link from "next/link";

export function ActionCard({
  title,
  description,
  href,
  right,
}: {
  title: string;
  description?: string;
  href: string;
  right?: ReactNode;
}) {
  return (
    <Link
      href={href}
      className="rounded-2xl border bg-foreground/0 p-4 shadow-sm transition hover:bg-foreground/5 active:bg-foreground/10"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-semibold">{title}</div>
          {description ? (
            <div className="mt-1 text-xs text-foreground/60">{description}</div>
          ) : null}
        </div>
        {right}
      </div>
    </Link>
  );
}

