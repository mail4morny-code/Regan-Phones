import { createBrowserClient } from "@supabase/ssr";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  // This should be configured in .env.local
  // Avoid console warnings during build/lint; fail at runtime if used.
}

export const supabaseBrowser = createBrowserClient(
  supabaseUrl!,
  supabaseAnonKey!
);



