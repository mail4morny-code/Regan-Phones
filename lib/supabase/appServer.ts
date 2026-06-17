import { cookies, headers } from "next/headers";

import { supabaseServerClient } from "@/lib/supabase/server";

export async function createSupabaseAppServerClient() {
  const [cookieStore, headerStore] = await Promise.all([cookies(), headers()]);

  return supabaseServerClient({
    headers: headerStore as unknown as Headers,
    cookies: {
      get(name: string) {
        return cookieStore.get(name)?.value;
      },
      set() {
        // Server components and actions in this app only need cookie reads.
      },
      remove() {
        // Server components and actions in this app only need cookie reads.
      },
    },
  });
}
