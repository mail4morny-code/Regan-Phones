import { createServerClient } from "@supabase/ssr";



import type { Database as DatabaseTypes } from "./types";

type Database = DatabaseTypes;





export function supabaseServerClient(opts: {
  headers: Headers;
  cookies: {
    get(name: string): string | undefined;
    set(...args: unknown[]): void;
    remove(...args: unknown[]): void;
  };
}) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY");
  }

  // createServerClient signature differs between versions; keep typing loose.
  return createServerClient<Database>(supabaseUrl, supabaseAnonKey, {
    cookies: {
      get(name: string) {
        return opts.cookies.get(name);
      },
      set(...args) {
        opts.cookies.set(...args);
      },
      remove(...args) {
        opts.cookies.remove(...args);
      },
    },
  });
}




