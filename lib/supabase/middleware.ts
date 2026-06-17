import { createServerClient } from "@supabase/ssr";
import type { NextRequest } from "next/server";

import type { Database as DatabaseTypes } from "./types";

type Database = DatabaseTypes;


export function supabaseMiddlewareClient(req: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    // Allow app pages to render even before Supabase env is configured.
    // Auth-protected pages will still enforce via server-side guards.
    return null as unknown as ReturnType<typeof createServerClient<Database>>;
  }


  // Supabase SSR client for middleware.
  // Cookie writes are not needed for middleware redirect logic.
  // TypeScript/cookie method typings vary by @supabase/ssr version.
  // Middleware needs only `auth.getUser()` + cookie reads; writes can be no-ops.
  return createServerClient<Database>(supabaseUrl, supabaseAnonKey, {
    cookies: {
      get(name: string) {
        return req.cookies.get(name)?.value;
      },
      getAll() {
        return req.cookies.getAll().map((c) => c);
      },
      set() {
        // no-op
      },
      remove() {
        // no-op
      },
    },
  } as unknown as Parameters<typeof createServerClient<Database>>[2]);
}


