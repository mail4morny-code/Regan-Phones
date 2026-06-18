"use client";

import Link from "next/link";
import * as React from "react";

import { supabaseBrowser } from "@/lib/supabase/client";

export function ForgotPasswordForm() {
  const [email, setEmail] = React.useState("");
  const [message, setMessage] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    setError(null);
    setLoading(true);

    const redirectTo = `${window.location.origin}/reset-password`;
    const { error: resetErr } = await supabaseBrowser.auth.resetPasswordForEmail(email.trim(), {
      redirectTo,
    });
    setLoading(false);

    if (resetErr) {
      setError("Could not send the reset link. Check the email and try again.");
      return;
    }

    setMessage("Reset link sent. Check your email and follow the link to choose a new password.");
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-3 rounded-lg border bg-card p-5 shadow-sm">
      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium">Email</span>
        <input
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          type="email"
          inputMode="email"
          autoComplete="email"
          required
          className="h-11 rounded-lg border bg-background px-3"
          placeholder="owner@example.com"
        />
      </label>

      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}
      {message ? (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">
          {message}
        </div>
      ) : null}

      <button
        disabled={loading}
        type="submit"
        className="mt-2 h-11 rounded-lg bg-primary px-4 font-semibold text-primary-foreground transition active:opacity-90 disabled:opacity-60"
      >
        {loading ? "Sending..." : "Send Reset Link"}
      </button>

      <Link href="/login" className="text-center text-sm font-medium underline underline-offset-4">
        Back to sign in
      </Link>
    </form>
  );
}
