"use client";

import { useActionState } from "react";

import { sellPhoneAction } from "@/lib/phones/sellPhoneAction";

export type SellPhoneFormState = { ok: true } | { ok: false; error: string };

export default function SellPhoneForm({ imei }: { imei: string }) {
  const [state, formAction, pending] = useActionState(sellPhoneAction, { ok: true } as SellPhoneFormState);

  return (
    <form className="rounded-lg border bg-card p-4 shadow-sm sm:p-5" action={formAction}>
      <input type="hidden" name="imei" value={imei} />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-muted-foreground">Customer name (optional)</span>
          <input name="customer_name" className="h-11 rounded-lg border bg-background px-3" />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-muted-foreground">Customer number (optional)</span>
          <input name="customer_phone" className="h-11 rounded-lg border bg-background px-3" />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-muted-foreground">Selling price (GHS)</span>
          <input name="selling_price" required type="number" step="0.01" min="0" className="h-11 rounded-lg border bg-background px-3" />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-muted-foreground">Payment method</span>
          <select name="payment_method" defaultValue="Cash" className="h-11 rounded-lg border bg-background px-3">
            <option value="Cash">Cash</option>
            <option value="Bank Transfer">Bank Transfer</option>
            <option value="Card">Card</option>
          </select>
        </label>
      </div>

      {state.ok === false ? (
        <div className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {state.error}
        </div>
      ) : null}

      <button disabled={pending} type="submit" className="mt-4 h-11 w-full rounded-lg bg-primary px-4 font-semibold text-primary-foreground active:opacity-90 disabled:opacity-60 sm:w-auto">
        {pending ? "Saving..." : "Save sale"}
      </button>

      <div className="mt-2 text-xs text-muted-foreground">Status becomes Sold after saving.</div>
    </form>
  );
}
