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

async function fetchAll(supabase, table, select, orderColumn = "id") {
  const pageSize = 1000;
  const rows = [];
  for (let from = 0; ; from += pageSize) {
    const to = from + pageSize - 1;
    const { data, error } = await supabase
      .from(table)
      .select(select)
      .order(orderColumn, { ascending: true })
      .range(from, to);
    if (error) throw new Error(`${table}: ${error.message}`);
    rows.push(...(data ?? []));
    if (!data || data.length < pageSize) break;
  }
  return rows;
}

async function fetchActivityRows(supabase) {
  try {
    return await fetchAll(
      supabase,
      "activity_log",
      "id, user_id, phone_id, dealer_id, action, description, created_at",
      "created_at"
    );
  } catch (error) {
    if (!String(error.message ?? "").includes("phone_id")) throw error;
    const rows = await fetchAll(
      supabase,
      "activity_log",
      "id, user_id, action, description, created_at",
      "created_at"
    );
    return rows.map((row) => ({ ...row, phone_id: null, dealer_id: null }));
  }
}

async function fetchDealerRecordRows(supabase) {
  try {
    return await fetchAll(
      supabase,
      "dealer_records",
      "id, phone_id, dealer_id, agreed_price, amount_paid, created_at, date_completed",
      "created_at"
    );
  } catch (error) {
    if (!String(error.message ?? "").includes("amount_paid")) throw error;
    const rows = await fetchAll(
      supabase,
      "dealer_records",
      "id, phone_id, dealer_id, agreed_price, created_at, date_completed",
      "created_at"
    );
    return rows.map((row) => ({ ...row, amount_paid: null }));
  }
}

function person(profile, fallback = "Staff member") {
  const fullName = String(profile?.full_name ?? "").trim();
  if (fullName) return fullName;
  const email = String(profile?.email ?? "").trim();
  if (email) return email;
  return fallback;
}

function money(value) {
  const amount = Number(value ?? 0);
  if (!Number.isFinite(amount)) return "GHS 0.00";
  return `GHS ${amount.toLocaleString("en-GH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function phoneName(phone) {
  const name = `${phone?.brand ?? ""} ${phone?.model ?? ""}`.trim();
  return name || "phone";
}

function extractImei(description) {
  return String(description ?? "").match(/IMEI\s+([A-Za-z0-9-]+)/i)?.[1] ?? null;
}

function extractDealer(description) {
  return String(description ?? "").match(/to dealer\s+(.+?)(?:\.|$)/i)?.[1]?.trim() ?? null;
}

function extractAgreed(description) {
  return String(description ?? "").match(/Agreed:\s*(.+)$/i)?.[1]?.trim() ?? null;
}

function extractBatchCount(description) {
  return String(description ?? "").match(/gave\s+(\d+\s+phones?)/i)?.[1]?.trim() ?? null;
}

function extractBatchTotal(description) {
  return String(description ?? "").match(/Total agreed:\s*(.+)$/i)?.[1]?.trim() ?? null;
}

function extractWorkerTarget(description, verb) {
  const match = String(description ?? "").match(new RegExp(`^${verb}\\s+worker\\s+(.+)$`, "i"));
  return match?.[1]?.trim() ?? null;
}

function latestDealerRecord(activity, dealerRecords) {
  const matches = dealerRecords.filter((record) => {
    if (activity.phone_id && record.phone_id !== activity.phone_id) return false;
    if (activity.dealer_id && record.dealer_id !== activity.dealer_id) return false;
    return activity.phone_id || activity.dealer_id;
  });
  return matches.sort((a, b) => {
    const aTime = new Date(a.date_completed ?? a.created_at ?? 0).getTime();
    const bTime = new Date(b.date_completed ?? b.created_at ?? 0).getTime();
    return bTime - aTime;
  })[0] ?? null;
}

function buildDescription(activity, maps) {
  const profile = maps.profiles.get(activity.user_id);
  const actor = person(profile);
  const phone = activity.phone_id ? maps.phones.get(activity.phone_id) : null;
  const dealer = activity.dealer_id ? maps.dealers.get(activity.dealer_id) : null;
  const dealerRecord = latestDealerRecord(activity, maps.dealerRecords);
  const imei = phone?.imei ?? extractImei(activity.description) ?? "not available";
  const dealerName = dealer?.name ?? extractDealer(activity.description) ?? "the dealer";

  switch (activity.action) {
    case "PHONE_ADDED":
      return `${actor} added phone IMEI ${imei}`;
    case "PHONE_UPDATED":
      return `${actor} updated ${phoneName(phone)} IMEI ${imei}`;
    case "PHONE_ARCHIVED":
      return `${actor} removed ${phoneName(phone)} IMEI ${imei} from active stock`;
    case "PHONE_DAMAGED":
      return `${actor} marked ${phoneName(phone)} IMEI ${imei} as damaged`;
    case "PHONE_SOLD":
      return `${actor} sold phone IMEI ${imei}. Money received.`;
    case "PHONE_SOLD_PENDING_CONFIRMATION":
      return `${actor} sold phone IMEI ${imei}. Owner needs to confirm payment.`;
    case "PHONE_GIVEN": {
      const agreed = extractAgreed(activity.description) ?? (dealerRecord?.agreed_price != null ? money(dealerRecord.agreed_price) : null);
      return `${actor} gave phone IMEI ${imei} to ${dealerName}${agreed ? `. Agreed: ${agreed}` : ""}`;
    }
    case "DEALER_BATCH_GIVEN": {
      const count = extractBatchCount(activity.description) ?? "phones";
      const total = extractBatchTotal(activity.description);
      return `${actor} gave ${count} to ${dealerName}${total ? `. Total agreed: ${total}` : ""}`;
    }
    case "PHONE_DEALER_SOLD": {
      const amountText = profile?.role === "admin" && dealerRecord?.agreed_price != null
        ? ` Money received: ${money(dealerRecord.amount_paid ?? dealerRecord.agreed_price)} of ${money(dealerRecord.agreed_price)}.`
        : " Owner needs to confirm payment.";
      return `${actor} marked ${dealerName}'s phone IMEI ${imei} as sold.${amountText}`;
    }
    case "PHONE_RETURNED":
      return `${actor} marked ${dealerName}'s phone IMEI ${imei} as returned to the shop.`;
    case "SALE_PAYMENT_CONFIRMED":
      return `${actor} confirmed money received for ${phoneName(phone)} IMEI ${imei}.`;
    case "WORKER_CREATED": {
      const target = extractWorkerTarget(activity.description, "Added");
      return target ? `${actor} added ${target}` : activity.description;
    }
    case "WORKER_ENABLED": {
      const target = extractWorkerTarget(activity.description, "Enabled");
      return target ? `${actor} enabled ${target}` : activity.description;
    }
    case "WORKER_DISABLED": {
      const target = extractWorkerTarget(activity.description, "Disabled");
      return target ? `${actor} disabled ${target}` : activity.description;
    }
    default:
      return activity.description;
  }
}

const env = readEnv(".env.local");
const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false },
});

const [activity, profiles, phones, dealers, dealerRecords] = await Promise.all([
  fetchActivityRows(supabase),
  fetchAll(supabase, "profiles", "id, full_name, email, role"),
  fetchAll(supabase, "phones", "id, imei, brand, model"),
  fetchAll(supabase, "dealers", "id, name"),
  fetchDealerRecordRows(supabase),
]);

const maps = {
  profiles: new Map(profiles.map((row) => [row.id, row])),
  phones: new Map(phones.map((row) => [row.id, row])),
  dealers: new Map(dealers.map((row) => [row.id, row])),
  dealerRecords,
};

let checked = 0;
let updated = 0;
let unchanged = 0;

for (const row of activity) {
  checked += 1;
  const nextDescription = buildDescription(row, maps);
  if (!nextDescription || nextDescription === row.description) {
    unchanged += 1;
    continue;
  }

  const { error } = await supabase
    .from("activity_log")
    .update({ description: nextDescription })
    .eq("id", row.id);

  if (error) throw new Error(`activity_log ${row.id}: ${error.message}`);
  updated += 1;
}

console.log(JSON.stringify({ checked, updated, unchanged }, null, 2));
