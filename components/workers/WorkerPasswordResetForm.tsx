"use client";

import { useActionState, useState } from "react";

import { resetWorkerPasswordAction, type WorkerActionState } from "@/lib/auth/workerActions";

const initialState: WorkerActionState = { ok: true };

export function WorkerPasswordResetForm({
  workerId,
  workerName,
}: {
  workerId: string;
  workerName: string;
}) {
  const [state, action, pending] = useActionState(resetWorkerPasswordAction, initialState);
  const [open, setOpen] = useState(false);

  return (
    <details
      open={open}
      onToggle={(event) => setOpen(event.currentTarget.open)}
      className="rounded-xl border bg-card"
    >
      <summary className="cursor-pointer list-none px-4 py-3 text-sm font-semibold text-foreground [&::-webkit-details-marker]:hidden">
        Reset Password
      </summary>
      <form action={action} className="border-t p-4">
        <input type="hidden" name="worker_id" value={workerId} />
        <label className="flex flex-col gap-2">
          <span className="text-sm font-medium text-muted-foreground">
            New temporary password for {workerName}
          </span>
          <input
            name="temporary_password"
            type="password"
            minLength={8}
            required
            autoComplete="new-password"
            className="h-11 rounded-xl border bg-background px-4"
            placeholder="At least 8 characters"
          />
        </label>
        <p className="mt-3 text-xs leading-5 text-muted-foreground">
          Share this password privately. The worker should sign in and change it in Settings.
        </p>

        {state.ok === false ? (
          <div className="mt-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {state.error}
          </div>
        ) : null}
        {state.ok && state.message ? (
          <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">
            {state.message}
          </div>
        ) : null}

        <div className="mt-4 flex flex-col gap-2 sm:flex-row">
          <button
            disabled={pending}
            className="h-10 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-60"
          >
            {pending ? "Resetting..." : "Set Temporary Password"}
          </button>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="h-10 rounded-xl border bg-background px-4 text-sm font-semibold"
          >
            Close
          </button>
        </div>
      </form>
    </details>
  );
}
