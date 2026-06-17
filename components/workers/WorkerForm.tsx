"use client";

import { useActionState } from "react";

import { createWorkerAction, type WorkerActionState } from "@/lib/auth/workerActions";

const initialState: WorkerActionState = { ok: true };

export function WorkerForm() {
  const [state, action, pending] = useActionState(createWorkerAction, initialState);

  return (
    <form action={action} className="rounded-2xl border border-black/5 bg-card p-6 shadow-sm md:p-8">
      <div className="flex flex-col gap-2">
        <h2 className="text-2xl font-semibold tracking-tight">Add Worker</h2>
        <p className="text-sm text-muted-foreground">
          Create a worker account directly. Workers sign in with the email and temporary password you provide.
        </p>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <label className="flex flex-col gap-2">
          <span className="text-sm font-medium text-muted-foreground">Name</span>
          <input name="full_name" required className="h-12 rounded-xl border bg-background px-4" placeholder="Worker name" />
        </label>
        <label className="flex flex-col gap-2">
          <span className="text-sm font-medium text-muted-foreground">Phone Number</span>
          <input name="phone_number" className="h-12 rounded-xl border bg-background px-4" placeholder="024..." />
        </label>
        <label className="flex flex-col gap-2">
          <span className="text-sm font-medium text-muted-foreground">Email</span>
          <input name="email" type="email" required className="h-12 rounded-xl border bg-background px-4" placeholder="worker@example.com" />
        </label>
        <label className="flex flex-col gap-2">
          <span className="text-sm font-medium text-muted-foreground">Temporary Password</span>
          <input name="temporary_password" type="password" minLength={8} required className="h-12 rounded-xl border bg-background px-4" placeholder="At least 8 characters" />
        </label>
      </div>

      <div className="mt-4 rounded-2xl border bg-background p-4 text-sm text-muted-foreground">
        This will create a worker account. Ask the worker to change this password after first login.
      </div>

      {state.ok === false ? (
        <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{state.error}</div>
      ) : null}
      {state.ok && state.message ? (
        <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">{state.message}</div>
      ) : null}

      <button disabled={pending} className="mt-6 h-12 rounded-xl bg-primary px-5 text-sm font-semibold text-primary-foreground disabled:opacity-60">
        {pending ? "Adding..." : "Add Worker"}
      </button>
    </form>
  );
}
