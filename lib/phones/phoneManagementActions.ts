"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireProfileRole } from "@/lib/auth/requireProfile";
import { createSupabaseAppServerClient } from "@/lib/supabase/appServer";
import type { Database } from "@/lib/supabase/types";
import { logActivity } from "@/lib/activity/logActivity";
import { isMissingColumnError, logSupabaseWarning } from "@/lib/supabase/errors";
import { createSupabaseOperationalServerClient } from "@/lib/supabase/operationalServer";

type PhoneStatus = Database["public"]["Tables"]["phones"]["Row"]["status"];
type PhoneCondition = Database["public"]["Tables"]["phones"]["Row"]["condition"];

export type EditPhoneState = { ok: true } | { ok: false; error: string };

function parseMoney(value: string) {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return null;
  return n;
}

function isPhoneStatus(value: string): value is PhoneStatus {
  return ["Available", "Sold", "With Dealer", "Returned", "Damaged", "Archived"].includes(value);
}

function isPhoneCondition(value: string): value is PhoneCondition {
  return value === "New" || value === "UK Used";
}

export async function editPhoneAction(
  prevState: unknown,
  formData: FormData
): Promise<EditPhoneState> {
  const profile = await requireProfileRole(["admin"]);
  const phoneId = String(formData.get("phone_id") ?? "").trim();
  const brand = String(formData.get("brand") ?? "").trim();
  const model = String(formData.get("model") ?? "").trim();
  const storage = String(formData.get("storage") ?? "").trim() || null;
  const color = String(formData.get("color") ?? "").trim() || null;
  const batteryHealth = String(formData.get("battery_health") ?? "").trim() || null;
  const conditionRaw = String(formData.get("condition") ?? "").trim();
  const statusRaw = String(formData.get("status") ?? "").trim();
  const costPrice = parseMoney(String(formData.get("cost_price") ?? ""));
  const sellingPrice = parseMoney(String(formData.get("selling_price") ?? ""));

  if (!phoneId) return { ok: false, error: "Choose a phone first." };
  if (!brand) return { ok: false, error: "Brand is required." };
  if (!model) return { ok: false, error: "Model is required." };
  if (!isPhoneCondition(conditionRaw)) return { ok: false, error: "Invalid condition." };
  if (!isPhoneStatus(statusRaw)) return { ok: false, error: "Invalid status." };
  if (costPrice === null) return { ok: false, error: "Cost price is invalid." };
  if (sellingPrice === null) return { ok: false, error: "Selling price is invalid." };

  const supabase = await createSupabaseAppServerClient();
  const { data: existing, error: existingErr } = await supabase
    .from("phones")
    .select("id, imei, brand, model")
    .eq("id", phoneId)
    .limit(1)
    .maybeSingle();

  if (existingErr || !existing) return { ok: false, error: "Phone not found." };

  const updatePayload = {
    brand,
    model,
    storage,
    color,
    battery_health: batteryHealth,
    condition: conditionRaw,
    status: statusRaw,
    cost_price: costPrice,
    selling_price: sellingPrice,
  };

  let updateResult = await supabase
    .from("phones")
    .update(updatePayload)
    .eq("id", phoneId);

  if (updateResult.error && isMissingColumnError(updateResult.error)) {
    const { battery_health, ...legacyPayload } = updatePayload;
    void battery_health;
    updateResult = await supabase
      .from("phones")
      .update(legacyPayload)
      .eq("id", phoneId);
  }

  const { error } = updateResult;

  if (error) return { ok: false, error: "Could not update this phone. Please try again." };

  await logActivity({
    userId: profile.id,
    action: "PHONE_UPDATED",
    phoneId,
    description: `Updated ${existing.brand} ${existing.model} IMEI ${existing.imei}`,
  });

  revalidatePath("/inventory");
  revalidatePath(`/phone-details/${encodeURIComponent(existing.imei)}`);
  redirect(`/phone-details/${encodeURIComponent(existing.imei)}`);
}

export async function archivePhoneAction(formData: FormData) {
  const profile = await requireProfileRole(["admin"]);
  const phoneId = String(formData.get("phone_id") ?? "").trim();
  if (!phoneId) return;

  const supabase = await createSupabaseAppServerClient();
  const { data: phone } = await supabase
    .from("phones")
    .select("imei, brand, model")
    .eq("id", phoneId)
    .limit(1)
    .maybeSingle();

  const { error } = await supabase.from("phones").update({ status: "Archived" }).eq("id", phoneId);
  if (error) {
    logSupabaseWarning("[Phones] Remove from active stock failed", error);
    return;
  }

  await logActivity({
    userId: profile.id,
    action: "PHONE_ARCHIVED",
    phoneId,
    description: `Removed from active stock: ${phone?.brand ?? "phone"} ${phone?.model ?? ""} IMEI ${phone?.imei ?? phoneId}`,
  });

  revalidatePath("/inventory");
  revalidatePath("/dashboard");
  if (phone?.imei) revalidatePath(`/phone-details/${encodeURIComponent(phone.imei)}`);
}

export async function markPhoneDamagedAction(formData: FormData) {
  const profile = await requireProfileRole();
  const phoneId = String(formData.get("phone_id") ?? "").trim();
  if (!phoneId) return;

  const supabase = await createSupabaseOperationalServerClient(profile);
  const { data: phone } = await supabase
    .from("phones")
    .select("imei, brand, model")
    .eq("id", phoneId)
    .limit(1)
    .maybeSingle();

  const { error } = await supabase.from("phones").update({ status: "Damaged" }).eq("id", phoneId);
  if (error) {
    logSupabaseWarning("[Phones] Mark damaged failed", error);
    return;
  }

  await logActivity({
    userId: profile.id,
    action: "PHONE_DAMAGED",
    phoneId,
    description: `Marked as damaged: ${phone?.brand ?? "phone"} ${phone?.model ?? ""} IMEI ${phone?.imei ?? phoneId}`,
  });

  revalidatePath("/inventory");
  revalidatePath("/dashboard");
  if (phone?.imei) revalidatePath(`/phone-details/${encodeURIComponent(phone.imei)}`);
}
