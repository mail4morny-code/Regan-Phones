"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

import { supabaseBrowser } from "@/lib/supabase/client";

export function SignupForm() {
  const router = useRouter();

  const [fullName, setFullName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const { data: signUpData, error: signUpErr } = await supabaseBrowser.auth.signUp({
      email,
      password,
      options: {
        // Keeps it simple: we rely on Supabase default email confirmation behaviour.
        // If email confirmations are enabled, signup will create the user but session may be null.
        data: { full_name: fullName || null },
      },
    });

    if (signUpErr) {
      setLoading(false);
      setError(signUpErr.message);
      return;
    }

    // If confirmations are disabled, we should have an active session.
    // Otherwise, user must confirm email in Supabase; we still create the profile via trigger/RPC.
    if (!signUpData?.user) {
      setLoading(false);
      setError("Signup succeeded but user session was not available.");
      return;
    }

    // Profiles should be auto-created by a DB trigger on auth.users.
    // If that trigger isn't present, signup will succeed but you won't be able to log in.

    router.push("/dashboard");
    router.refresh();

  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-3 rounded-lg border bg-card p-5 shadow-sm">
      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium">Full name (optional)</span>
        <input
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          type="text"
          autoComplete="name"
          className="h-11 rounded-lg border bg-background px-3"
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium">Email</span>
        <input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          type="email"
          inputMode="email"
          autoComplete="email"
          required
          className="h-11 rounded-lg border bg-background px-3"
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium">Password</span>
        <input
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          type="password"
          autoComplete="new-password"
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
        {loading ? "Creating account..." : "Create account"}
      </button>

      <p className="text-xs text-muted-foreground">
        Use this only for initial owner setup. Workers should be created by the owner from the Workers page.
      </p>
    </form>
  );
}

