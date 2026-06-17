"use client";

import { useState, useTransition } from "react";
import { updateDealerRecordAction } from "@/lib/dealers/updateDealerRecordAction";
import { formatPhoneStatus } from "@/lib/format/display";

export default function UpdateDealerRecordControls({
  dealerRecordId,
  defaultStatus,
  agreedPrice,
}: {
  dealerRecordId: string;
  defaultStatus: string;
  agreedPrice?: number;
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  async function submit(nextStatus: "Sold" | "Returned", formData?: FormData) {
    const confirmed = window.confirm(nextStatus === "Sold" ? "Mark this dealer phone as sold?" : "Mark this phone as returned to the shop?");
    if (!confirmed) return;

    setError(null);
    startTransition(async () => {
      const payload = formData ?? new FormData();
      payload.set("dealer_record_id", dealerRecordId);
      payload.set("next_status", nextStatus);

      const res = await updateDealerRecordAction(null, payload);
      if (!res.ok) setError(res.error);
    });
  }

  return (
    <div className="flex flex-col gap-2">
      <form
        action={(formData) => submit("Sold", formData)}
        className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_auto]"
      >
        <label className="flex flex-col gap-1">
          <span className="text-[11px] text-muted-foreground">Amount paid (GHS)</span>
          <input
            name="amount_paid"
            type="number"
            min="0"
            step="0.01"
            defaultValue={agreedPrice ?? ""}
            className="h-10 rounded-lg border bg-card px-3 text-sm"
          />
        </label>
        <button
          type="submit"
          disabled={isPending}
          className="flex h-10 items-center justify-center rounded-lg bg-primary px-3 text-sm font-semibold text-primary-foreground disabled:opacity-50"
        >
          Mark as Sold
        </button>
      </form>
      <div>
        <button
          type="button"
          disabled={isPending}
          onClick={() => submit("Returned")}
          className="flex h-10 w-full items-center justify-center rounded-lg border bg-card px-3 text-sm font-semibold disabled:opacity-50"
        >
          Phone Returned to Shop
        </button>
      </div>
      {error ? <div className="text-xs text-red-600">{error}</div> : null}
      {defaultStatus ? <div className="text-[11px] text-muted-foreground">Current status: {formatPhoneStatus(defaultStatus)}</div> : null}
    </div>
  );
}

