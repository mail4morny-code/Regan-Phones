"use client";

export function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="h-11 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground print:hidden"
    >
      Print receipt
    </button>
  );
}
