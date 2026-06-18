"use client";

import Link from "next/link";
import * as React from "react";

import { supabaseBrowser } from "@/lib/supabase/client";

type ResetState = "checking" | "ready" | "done" | "invalid";

export function ResetPasswordForm() {
  const [state, setState] = React.useState<ResetState>("checking");
  const [password, setPassword] = React.useState("");
  const [confirmPassword, setConfirmPassword] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    let active = true;

    async function prepareRecoverySession() {
      setError(null);
      const url = new URL(window.location.href);
      const code = url.searchParams.get("code");
      const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
      const accessToken = hash.get("access_token");
      const refreshToken = hash.get("refresh_token");

      if (code) {
        const { error: exchangeErr } = await supabaseBrowser.auth.exchangeCodeForSession(code);
        if (exchangeErr) {
          if (!active) return;
          setError("This reset link is expired or invalid. Please request a new link.");
          setState("invalid");
          return;
        }
        window.history.replaceState(null, "", "/reset-password");
      } else if (accessToken && refreshToken) {
        const { error: sessionErr } = await supabaseBrowser.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });
        if (sessionErr) {
          if (!active) return;
          setError("This reset link is expired or invalid. Please request a new link.");
          setState("invalid");
          return;
        }
        window.history.replaceState(null, "", "/reset-password");
      }

      const { data } = await supabaseBrowser.auth.getSession();
      if (!active) return;
      if (!data.session) {
        setError("Open the reset link from your email, or request a new one.");
        setState("invalid");
        return;
      }

      setState("ready");
    }

    void prepareRecoverySession();

    return () => {
      active = false;
    };
  }, []);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
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
    if (!updateErr) await supabaseBrowser.auth.signOut();
    setLoading(false);

    if (updateErr) {
      setError("Could not update the password. Please request a new reset link and try again.");
      return;
    }

    setPassword("");
    setConfirmPassword("");
    setState("done");
  }

  if (state === "checking") {
    return (
      <div className="rounded-lg border bg-card p-5 text-sm text-muted-foreground shadow-sm">
        Checking reset link...
      </div>
    );
  }

  if (state === "done") {
    return (
      <div className="rounded-lg border bg-card p-5 shadow-sm">
        <div className="text-lg font-semibold">Password Updated</div>
        <p className="mt-2 text-sm text-muted-foreground">
          Your password has been changed. Sign in again with the new password.
        </p>
        <Link
          href="/login"
          className="mt-4 inline-flex h-11 items-center justify-center rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground"
        >
          Go to Sign In
        </Link>
      </div>
    );
  }

  if (state === "invalid") {
    return (
      <div className="rounded-lg border bg-card p-5 shadow-sm">
        <div className="text-lg font-semibold">Reset Link Needed</div>
        <p className="mt-2 text-sm text-muted-foreground">
          {error ?? "This reset link cannot be used."}
        </p>
        <Link
          href="/forgot-password"
          className="mt-4 inline-flex h-11 items-center justify-center rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground"
        >
          Send New Reset Link
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-3 rounded-lg border bg-card p-5 shadow-sm">
      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium">New password</span>
        <input
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          type="password"
          autoComplete="new-password"
          minLength={8}
          required
          className="h-11 rounded-lg border bg-background px-3"
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium">Confirm password</span>
        <input
          value={confirmPassword}
          onChange={(event) => setConfirmPassword(event.target.value)}
          type="password"
          autoComplete="new-password"
          minLength={8}
          required
          className="h-11 rounded-lg border bg-background px-3"
        />
      </label>

      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      <button
        disabled={loading}
        type="submit"
        className="mt-2 h-11 rounded-lg bg-primary px-4 font-semibold text-primary-foreground transition active:opacity-90 disabled:opacity-60"
      >
        {loading ? "Updating..." : "Choose New Password"}
      </button>
    </form>
  );
}
