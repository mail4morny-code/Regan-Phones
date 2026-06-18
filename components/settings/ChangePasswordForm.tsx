"use client";

import type { FormEvent } from "react";
import { useState } from "react";

import { supabaseBrowser } from "@/lib/supabase/client";

export function ChangePasswordForm() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    setError(null);

    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    const { error: updateErr } = await supabaseBrowser.auth.updateUser({
      password,
      data: { must_change_password: false },
    });
    setLoading(false);

    if (updateErr) {
      setError(updateErr.message);
      return;
    }

    setPassword("");
    setConfirmPassword("");
    setMessage("Password Updated.");
  }

  return (
    <form onSubmit={onSubmit} className="mt-6 grid gap-4 md:grid-cols-2">
      <label className="flex flex-col gap-2">
        <span className="text-sm font-medium text-muted-foreground">New password</span>
        <input
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          type="password"
          autoComplete="new-password"
          minLength={8}
          className="h-12 rounded-xl border bg-background px-4"
        />
      </label>
      <label className="flex flex-col gap-2">
        <span className="text-sm font-medium text-muted-foreground">Confirm password</span>
        <input
          value={confirmPassword}
          onChange={(event) => setConfirmPassword(event.target.value)}
          type="password"
          autoComplete="new-password"
          minLength={8}
          className="h-12 rounded-xl border bg-background px-4"
        />
      </label>

      {error ? <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700 md:col-span-2">{error}</div> : null}
      {message ? <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700 md:col-span-2">{message}</div> : null}

      <div className="md:col-span-2">
        <button disabled={loading} className="h-12 w-full rounded-xl bg-primary px-5 text-sm font-semibold text-primary-foreground disabled:opacity-60 sm:w-auto">
          {loading ? "Updating..." : "Change password"}
        </button>
      </div>
    </form>
  );
}
