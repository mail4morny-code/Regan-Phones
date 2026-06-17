"use client";

import Link from "next/link";
import { useActionState, useMemo, useState } from "react";

import { StatusBadge } from "@/components/ui/StatusBadge";
import { giveMultipleToDealerAction } from "@/lib/dealers/giveToDealerAction";
import { formatMoney } from "@/lib/format/currency";

type Phone = {
  id: string;
  imei: string;
  brand: string;
  model: string;
  storage: string | null;
  color: string | null;
  condition: string;
  selling_price: number;
  status: string;
};

type State = { ok: true } | { ok: false; error: string };

const initialState: State = { ok: true };

export function MultiGiveToDealerForm({ phones }: { phones: Phone[] }) {
  const [state, formAction, pending] = useActionState(giveMultipleToDealerAction, initialState);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const today = new Date().toISOString().slice(0, 10);

  const selectedPhones = useMemo(
    () => phones.filter((phone) => selectedIds.includes(phone.id)),
    [phones, selectedIds]
  );

  function togglePhone(id: string) {
    setSelectedIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  }

  function selectPhone(id: string) {
    setSelectedIds((current) => current.includes(id) ? current : [...current, id]);
  }

  return (
    <form action={formAction} className="flex flex-col gap-4">
      {selectedIds.map((id) => (
        <input key={id} type="hidden" name="phone_ids" value={id} />
      ))}

      <section className="rounded-lg border bg-card p-4 shadow-sm sm:p-5">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="text-sm font-semibold">Available phones</div>
            <div className="text-xs text-muted-foreground">Click Give to Dealer on a phone, then fill the dealer form below.</div>
          </div>
          <div className="rounded-lg bg-background px-3 py-2 text-sm font-semibold">
            {selectedPhones.length} selected
          </div>
        </div>

        <div className="mt-4 flex flex-col gap-3 lg:hidden">
          {phones.map((phone) => {
            const selected = selectedIds.includes(phone.id);
            return (
              <article key={phone.id} className={selected ? "rounded-lg border border-primary bg-background p-3 shadow-sm sm:p-4" : "rounded-lg border bg-background p-3 shadow-sm sm:p-4"}>
                <div className="flex items-start justify-between gap-3">
                  <label className="flex min-w-0 items-start gap-3">
                    <input type="checkbox" checked={selected} onChange={() => togglePhone(phone.id)} className="mt-1 h-4 w-4" />
                    <span>
                      <span className="block text-sm font-semibold">{phone.brand} {phone.model}</span>
                      <span className="mt-1 block text-xs text-muted-foreground">IMEI {phone.imei}</span>
                    </span>
                  </label>
                  <StatusBadge status={phone.status} />
                </div>
                <div className="mt-3 text-xs text-muted-foreground">
                  {[phone.storage, phone.color, phone.condition].filter(Boolean).join(" / ")}
                </div>
                <div className="mt-2 text-sm font-semibold">{formatMoney(phone.selling_price)}</div>
                <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={() => selectPhone(phone.id)}
                    className="flex h-10 items-center justify-center rounded-lg bg-primary px-3 text-sm font-semibold text-primary-foreground"
                  >
                    {selected ? "Selected for dealer" : "Give to Dealer"}
                  </button>
                  <Link href={`/sell-phone?imei=${encodeURIComponent(phone.imei)}`} className="flex h-10 items-center justify-center rounded-lg border bg-card px-3 text-sm font-semibold">
                    Sell
                  </Link>
                </div>
              </article>
            );
          })}
        </div>

        <div className="mt-4 hidden overflow-auto lg:block">
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-muted-foreground">
              <tr>
                <th className="py-2 pr-4">Select</th>
                <th className="py-2 pr-4">IMEI</th>
                <th className="py-2 pr-4">Phone</th>
                <th className="py-2 pr-4">Details</th>
                <th className="py-2 pr-4">Price</th>
                <th className="py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {phones.map((phone) => {
                const selected = selectedIds.includes(phone.id);
                return (
                  <tr key={phone.id} className={selected ? "border-t bg-primary/5" : "border-t"}>
                    <td className="py-3 pr-4">
                      <input type="checkbox" checked={selected} onChange={() => togglePhone(phone.id)} className="h-4 w-4" />
                    </td>
                    <td className="py-3 pr-4 font-mono text-xs">{phone.imei}</td>
                    <td className="py-3 pr-4">
                      <div className="font-semibold">{phone.brand} {phone.model}</div>
                      <div className="text-xs text-muted-foreground">{phone.condition}</div>
                    </td>
                    <td className="py-3 pr-4 text-xs text-muted-foreground">{[phone.storage, phone.color].filter(Boolean).join(" / ") || "Not set"}</td>
                    <td className="py-3 pr-4">{formatMoney(phone.selling_price)}</td>
                    <td className="py-3">
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => selectPhone(phone.id)}
                          className="inline-flex h-9 items-center rounded-lg bg-primary px-3 text-xs font-semibold text-primary-foreground"
                        >
                          {selected ? "Selected" : "Give to Dealer"}
                        </button>
                        <Link href={`/sell-phone?imei=${encodeURIComponent(phone.imei)}`} className="inline-flex h-9 items-center rounded-lg border bg-card px-3 text-xs font-semibold">Sell</Link>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {selectedPhones.length > 0 ? (
        <section className="rounded-lg border bg-card p-4 shadow-sm sm:p-5">
          <div className="text-sm font-semibold">Dealer details</div>
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium text-muted-foreground">Dealer name</span>
              <input name="dealer_name" required className="h-11 rounded-lg border bg-background px-3" />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium text-muted-foreground">Dealer phone number</span>
              <input name="dealer_phone" required className="h-11 rounded-lg border bg-background px-3" />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium text-muted-foreground">Date given</span>
              <input name="date_given" type="date" defaultValue={today} className="h-11 rounded-lg border bg-background px-3" />
            </label>
          </div>

          <div className="mt-5 text-sm font-semibold">Selected phones and agreed prices</div>
          <div className="mt-3 grid gap-3 lg:grid-cols-2">
            {selectedPhones.map((phone) => (
              <div key={phone.id} className="rounded-lg border bg-background p-3">
                <div className="text-sm font-semibold">{phone.brand} {phone.model}</div>
                <div className="mt-1 text-xs text-muted-foreground">IMEI {phone.imei} / Listed {formatMoney(phone.selling_price)}</div>
                <label className="mt-3 flex flex-col gap-1">
                  <span className="text-xs font-medium text-muted-foreground">Agreed price (GHS)</span>
                  <input
                    name={`agreed_price_${phone.id}`}
                    required
                    type="number"
                    min="0"
                    step="0.01"
                    defaultValue={Number(phone.selling_price || 0)}
                    className="h-11 rounded-lg border bg-card px-3"
                  />
                </label>
              </div>
            ))}
          </div>

          {state.ok === false ? (
            <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</div>
          ) : null}

          <button disabled={pending} className="mt-4 h-11 w-full rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-60 sm:w-auto">
            {pending ? "Saving..." : `Give ${selectedPhones.length} phone${selectedPhones.length === 1 ? "" : "s"} to dealer`}
          </button>
        </section>
      ) : (
        <section className="rounded-lg border border-dashed bg-card p-5 text-sm text-muted-foreground">
          Select at least one phone with the Give to Dealer button to open the dealer details form.
        </section>
      )}
    </form>
  );
}
