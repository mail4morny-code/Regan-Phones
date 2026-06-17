"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { logActivity } from "@/lib/activity/logActivity";
import { formatPersonName } from "@/lib/format/display";
import { createSupabaseAppServerClient } from "@/lib/supabase/appServer";
import { isMissingColumnError } from "@/lib/supabase/errors";
import type { Database } from "@/lib/supabase/types";

type PhoneInsert = Database["public"]["Tables"]["phones"]["Insert"];
type PhoneStatus = Database["public"]["Tables"]["phones"]["Row"]["status"];

type AddPhoneForm = {
  imei: string;
  brand: string;
  model: string;
  storage?: string;
  color?: string;
  battery_health?: string;
  condition: "New" | "UK Used";
  cost_price: string;
  selling_price: string;
  status?: PhoneStatus;
};

function parseMoney(value: string) {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return null;
  return n;
}

export async function addPhone(
  prevState: unknown,
  formData: FormData
): Promise<{ ok: true } | { ok: false; error: string }> {
  const data: AddPhoneForm = {
    imei: String(formData.get("imei") ?? "").trim(),
    brand: String(formData.get("brand") ?? "").trim(),
    model: String(formData.get("model") ?? "").trim(),
    storage: String(formData.get("storage") ?? "").trim() || undefined,
    color: String(formData.get("color") ?? "").trim() || undefined,
    battery_health: String(formData.get("battery_health") ?? "").trim() || undefined,
    condition: String(formData.get("condition") ?? "New") as AddPhoneForm["condition"],
    cost_price: String(formData.get("cost_price") ?? ""),
    selling_price: String(formData.get("selling_price") ?? ""),
    status: String(formData.get("status") ?? "Available") as PhoneStatus,
  };

  if (!data.imei) return { ok: false, error: "IMEI is required." };
  if (!data.brand) return { ok: false, error: "Brand is required." };
  if (!data.model) return { ok: false, error: "Model is required." };

  const costPrice = parseMoney(data.cost_price);
  const sellingPrice = parseMoney(data.selling_price);
  if (costPrice === null) return { ok: false, error: "Cost price is invalid." };
  if (sellingPrice === null) return { ok: false, error: "Selling price is invalid." };

  const supabase = await createSupabaseAppServerClient();
  const {
    data: { user },
    error: userErr,
  } = await supabase.auth.getUser();

  if (userErr || !user) return { ok: false, error: "Not logged in." };

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, email")
    .eq("id", user.id)
    .limit(1)
    .maybeSingle();

  const phoneInsert: PhoneInsert = {
    imei: data.imei,
    brand: data.brand,
    model: data.model,
    storage: data.storage ?? null,
    color: data.color ?? null,
    battery_health: data.battery_health ?? null,
    condition: data.condition,
    cost_price: costPrice,
    selling_price: sellingPrice,
    status: data.status ?? "Available",
    created_by: user.id,
  };

  let insertResult = await supabase
    .from("phones")
    .insert(phoneInsert)
    .select("id, imei")
    .single();

  if (insertResult.error && isMissingColumnError(insertResult.error)) {
    const legacyPhoneInsert: PhoneInsert = { ...phoneInsert };
    delete legacyPhoneInsert.battery_health;
    insertResult = await supabase
      .from("phones")
      .insert(legacyPhoneInsert)
      .select("id, imei")
      .single();
  }

  const { data: inserted, error } = insertResult;

  if (error) {
    const msg = String(error.message ?? "");
    if (msg.toLowerCase().includes("duplicate") || msg.toLowerCase().includes("unique")) {
      return { ok: false, error: "That IMEI already exists in stock." };
    }
    return { ok: false, error: msg || "Could not add this phone. Please try again." };
  }

  await logActivity({
    userId: user.id,
    action: "PHONE_ADDED",
    phoneId: inserted.id,
    description: `${formatPersonName(profile?.full_name, profile?.email ?? user.email)} added phone IMEI ${inserted.imei}`,
  });

  revalidatePath("/inventory");
  revalidatePath("/dashboard");
  revalidatePath("/notifications");
  redirect("/inventory");
}
