import Link from "next/link";
import { ReactNode } from "react";

export function ActionButtonCard({
  href,
  title,
  description,
  icon,
}: {
  href: string;
  title: string;
  description?: string;
  icon?: ReactNode;
}) {
  return (
    <Link
      href={href}
      className="block rounded-2xl border border-black/5 bg-card p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-gray-300 hover:shadow-md active:translate-y-0 sm:p-6"
    >
      <div className="flex items-start gap-3 sm:gap-4">
        {icon ? <div className="mt-0.5">{icon}</div> : null}
        <div className="min-w-0">
          <div className="text-base font-semibold">{title}</div>
          {description ? (
            <div className="mt-2 text-sm text-muted-foreground">{description}</div>
          ) : null}
        </div>
      </div>
    </Link>
  );
}

