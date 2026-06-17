"use client";

import { useActionState } from "react";

import { editPhoneAction, type EditPhoneState } from "@/lib/phones/phoneManagementActions";
import type { Database } from "@/lib/supabase/types";

type Phone = Pick<
  Database["public"]["Tables"]["phones"]["Row"],
  "id" | "imei" | "brand" | "model" | "storage" | "color" | "battery_health" | "condition" | "cost_price" | "selling_price" | "status"
>;

const initialState: EditPhoneState = { ok: true };

export function EditPhoneForm({ phone }: { phone: Phone }) {
  const [state, action, pending] = useActionState(editPhoneAction, initialState);
  const isApple = phone.brand.toLowerCase() === "apple";

  return (
    <form action={action} className="rounded-lg border bg-card p-4 shadow-sm sm:p-5">
      <input type="hidden" name="phone_id" value={phone.id} />
      <div className="mb-4 rounded-lg bg-background p-3 text-sm">
        <span className="text-muted-foreground">IMEI</span>
        <span className="ml-2 font-mono font-semibold">{phone.imei}</span>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-muted-foreground">Brand</span>
          <input name="brand" defaultValue={phone.brand} required className="h-11 rounded-lg border bg-background px-3" />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-muted-foreground">Model</span>
          <input name="model" defaultValue={phone.model} required className="h-11 rounded-lg border bg-background px-3" />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-muted-foreground">Storage</span>
          <input name="storage" defaultValue={phone.storage ?? ""} className="h-11 rounded-lg border bg-background px-3" />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-muted-foreground">Color</span>
          <input name="color" defaultValue={phone.color ?? ""} className="h-11 rounded-lg border bg-background px-3" />
        </label>
        {isApple ? (
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-muted-foreground">Battery health</span>
            <input name="battery_health" defaultValue={phone.battery_health ?? ""} className="h-11 rounded-lg border bg-background px-3" placeholder="e.g. 89%" />
          </label>
        ) : null}
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-muted-foreground">Condition</span>
          <select name="condition" defaultValue={phone.condition} className="h-11 rounded-lg border bg-background px-3">
            <option value="New">Brand New</option>
            <option value="UK Used">UK Used</option>
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-muted-foreground">Status</span>
          <select name="status" defaultValue={phone.status} className="h-11 rounded-lg border bg-background px-3">
            <option value="Available">Available</option>
            <option value="Sold">Sold</option>
            <option value="With Dealer">With Dealer</option>
            <option value="Returned">Returned by Dealer</option>
            <option value="Damaged">Damaged</option>
            <option value="Archived">Removed from Active Stock</option>
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-muted-foreground">Cost price (GHS)</span>
          <input name="cost_price" type="number" step="0.01" min="0" defaultValue={phone.cost_price} required className="h-11 rounded-lg border bg-background px-3" />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-muted-foreground">Selling price (GHS)</span>
          <input name="selling_price" type="number" step="0.01" min="0" defaultValue={phone.selling_price} required className="h-11 rounded-lg border bg-background px-3" />
        </label>
      </div>

      {state.ok === false ? (
        <div className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{state.error}</div>
      ) : null}

      <button disabled={pending} className="mt-4 h-11 w-full rounded-lg bg-primary px-4 font-semibold text-primary-foreground disabled:opacity-60 sm:w-auto">
        {pending ? "Saving..." : "Save changes"}
      </button>
    </form>
  );
}
