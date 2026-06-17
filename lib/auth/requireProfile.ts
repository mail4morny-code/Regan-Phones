import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";

import { supabaseServerClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/types";
import { logSupabaseWarning } from "@/lib/supabase/errors";

export type ProfileRole = Database["public"]["Tables"]["profiles"]["Row"]["role"];
export type Profile = Database["public"]["Tables"]["profiles"]["Row"];

type ProfileGuardResult = Pick<Profile, "id" | "email" | "full_name" | "role" | "is_active">;

export function getRedirectToLogin(redirectTo?: string) {
  const params = new URLSearchParams();
  if (redirectTo) params.set("redirect", redirectTo);
  return `/login${params.toString() ? `?${params.toString()}` : ""}`;
}

function redirectToProfileSetupError(): never {
  redirect("/profile-setup-error");
}

async function fetchProfile(
  supabase: ReturnType<typeof supabaseServerClient>,
  userId: string
): Promise<ProfileGuardResult | null> {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, email, full_name, role, is_active")
    .eq("id", userId)
    .limit(1)
    .maybeSingle();

  if (error) {
    logSupabaseWarning("[Auth] Account lookup failed", error);
    return null;
  }

  return data;
}

export async function requireProfileRole(allowed?: Array<ProfileRole>): Promise<ProfileGuardResult> {
  const [cookieStore, headerStore] = await Promise.all([cookies(), headers()]);

  const supabase = supabaseServerClient({
    headers: headerStore as unknown as Headers,
    cookies: {
      get(name: string) {
        return cookieStore.get(name)?.value;
      },
      set() {
        // Read-only profile guard.
      },
      remove() {
        // Read-only profile guard.
      },
    },
  });

  const {
    data: { user },
    error: userErr,
  } = await supabase.auth.getUser();

  if (userErr || !user) {
    redirect(getRedirectToLogin());
  }

  let profile = await fetchProfile(supabase, user.id);

  if (!profile) {
    const email = user.email ?? "";
    const { error: upsertErr } = await supabase.from("profiles").upsert(
      {
        id: user.id,
        email,
        full_name: null,
        role: "admin",
        is_active: true,
      },
      { onConflict: "id" }
    );

    if (upsertErr) {
      logSupabaseWarning("[Auth] Account setup failed", upsertErr);
      redirectToProfileSetupError();
    }

    profile = await fetchProfile(supabase, user.id);
  }

  if (!profile) {
    redirectToProfileSetupError();
  }

  if (!profile.is_active) {
    redirectToProfileSetupError();
  }

  const role = profile.role as ProfileRole;

  if (allowed && allowed.length > 0 && !allowed.includes(role)) {
    redirect("/dashboard");
  }

  return profile;
}
