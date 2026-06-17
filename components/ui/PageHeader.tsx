import { ReactNode } from "react";

export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-black/5 bg-card p-4 shadow-sm sm:p-6 md:p-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl md:text-4xl">{title}</h1>
          {subtitle ? <p className="mt-2 text-sm leading-6 text-muted-foreground sm:mt-3 sm:text-base">{subtitle}</p> : null}
        </div>
        {actions ? <div className="min-w-0 [&_a]:w-full sm:[&_a]:w-auto">{actions}</div> : null}
      </div>
    </div>
  );
}

