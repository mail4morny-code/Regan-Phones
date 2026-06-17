"use client";

import { useActionState } from "react";

import { giveToDealerAction } from "@/lib/dealers/giveToDealerAction";

export type GiveToDealerFormState = { ok: true } | { ok: false; error: string };

export default function GiveToDealerForm({ imei }: { imei: string }) {
  const [state, formAction, pending] = useActionState(giveToDealerAction, { ok: true } as GiveToDealerFormState);
  const today = new Date().toISOString().slice(0, 10);

  return (
    <form className="rounded-lg border bg-card p-4 shadow-sm sm:p-5" action={formAction}>
      <input type="hidden" name="imei" value={imei} />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-muted-foreground">Dealer name</span>
          <input name="dealer_name" required className="h-11 rounded-lg border bg-background px-3" />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-muted-foreground">Dealer phone number</span>
          <input name="dealer_phone" required className="h-11 rounded-lg border bg-background px-3" />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-muted-foreground">Agreed price (GHS)</span>
          <input name="agreed_price" required type="number" step="0.01" min="0" className="h-11 rounded-lg border bg-background px-3" />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-muted-foreground">Date given</span>
          <input name="date_given" required type="date" defaultValue={today} className="h-11 rounded-lg border bg-background px-3" />
        </label>
      </div>

      {state.ok === false ? (
        <div className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {state.error}
        </div>
      ) : null}

      <button disabled={pending} type="submit" className="mt-4 h-11 w-full rounded-lg bg-primary px-4 font-semibold text-primary-foreground active:opacity-90 disabled:opacity-60 sm:w-auto">
        {pending ? "Saving..." : "Give Phone to Dealer"}
      </button>

      <div className="mt-2 text-xs text-muted-foreground">The phone status becomes With Dealer after saving.</div>
    </form>
  );
}
