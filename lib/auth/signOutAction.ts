"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";

import { supabaseServerClient } from "@/lib/supabase/server";

function readCookieName(args: unknown[]) {
  const first = args[0];
  if (typeof first === "string") return first;
  if (first && typeof first === "object" && "name" in first) {
    const name = (first as { name?: unknown }).name;
    return typeof name === "string" ? name : null;
  }
  return null;
}

export async function signOutAction() {
  const [cookieStore, headerStore] = await Promise.all([cookies(), headers()]);

  const supabase = supabaseServerClient({
    headers: headerStore as unknown as Headers,
    cookies: {
      get(name: string) {
        return cookieStore.get(name)?.value;
      },
      set(...args) {
        const first = args[0];
        if (typeof first === "string" && typeof args[1] === "string") {
          cookieStore.set(first, args[1], args[2] as Parameters<typeof cookieStore.set>[2]);
          return;
        }

        if (first && typeof first === "object" && "name" in first && "value" in first) {
          const cookie = first as { name?: unknown; value?: unknown; options?: unknown };
          if (typeof cookie.name === "string" && typeof cookie.value === "string") {
            cookieStore.set(cookie.name, cookie.value, cookie.options as Parameters<typeof cookieStore.set>[2]);
          }
        }
      },
      remove(...args) {
        const name = readCookieName(args);
        if (name) cookieStore.delete(name);
      },
    },
  });

  await supabase.auth.signOut();
  redirect("/login");
}
