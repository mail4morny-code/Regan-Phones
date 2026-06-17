import fs from "node:fs";
import { createClient } from "@supabase/supabase-js";

function readEnv(path) {
  const values = {};
  const text = fs.readFileSync(path, "utf8");
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const index = line.indexOf("=");
    if (index === -1) continue;
    const key = line.slice(0, index).trim();
    const value = line.slice(index + 1).trim().replace(/^['"]|['"]$/g, "");
    values[key] = value;
  }
  return values;
}

const env = readEnv(".env.local");
const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY.");
  process.exit(1);
}

const projectRef = supabaseUrl.match(/^https:\/\/([^.]+)\.supabase\.co/)?.[1] ?? "unknown";
const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: { persistSession: false },
});

const expectedTables = [
  "profiles",
  "phones",
  "sales",
  "dealers",
  "dealer_records",
  "activity_log",
];

console.log(JSON.stringify({ projectUrl: supabaseUrl, projectRef }, null, 2));

for (const table of expectedTables) {
  const { error, status } = await supabase.from(table).select("*").limit(1);
  console.log(
    JSON.stringify({
      table,
      status,
      exists: !error,
      errorCode: error?.code ?? null,
      errorMessage: error?.message ?? null,
    })
  );
}
