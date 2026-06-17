"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { logActivity } from "@/lib/activity/logActivity";
import { requireProfileRole } from "@/lib/auth/requireProfile";
import { formatPersonName } from "@/lib/format/display";
import { isMissingColumnError } from "@/lib/supabase/errors";
import { createSupabaseOperationalServerClient } from "@/lib/supabase/operationalServer";
import type { Database } from "@/lib/supabase/types";

type ProfitRow = Database["public"]["Tables"]["sales"]["Insert"];

function parseMoney(value: string) {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return null;
  return n;
}

export async function sellPhoneAction(
  prevState: unknown,
  formData: FormData
): Promise<{ ok: true } | { ok: false; error: string }> {
  const imei = String(formData.get("imei") ?? "").trim();
  const customerName = String(formData.get("customer_name") ?? "").trim() || null;
  const customerPhone = String(formData.get("customer_phone") ?? "").trim() || null;
  const sellingPriceRaw = String(formData.get("selling_price") ?? "").trim();
  const paymentMethod = String(formData.get("payment_method") ?? "Cash").trim();

  if (!imei) return { ok: false, error: "IMEI is required." };

  const sellingPrice = parseMoney(sellingPriceRaw);
  if (sellingPrice === null) return { ok: false, error: "Selling price is invalid." };

  const profile = await requireProfileRole();
  const supabase = await createSupabaseOperationalServerClient(profile);

  const { data: phone, error: phoneErr } = await supabase
    .from("phones")
    .select("id, imei, cost_price, status")
    .eq("imei", imei)
    .limit(1)
    .maybeSingle();

  if (phoneErr || !phone) return { ok: false, error: "Phone not found." };
  if (phone.status === "Sold") return { ok: false, error: "This phone is already marked as Sold." };
  if (phone.status === "Archived") return { ok: false, error: "Phones removed from active stock cannot be sold." };

  const profit = sellingPrice - Number(phone.cost_price ?? 0);
  const isAdminSale = profile.role === "admin";
  const now = new Date().toISOString();

  const salePayload = {
    phone_id: phone.id,
    customer_name: customerName,
    customer_phone: customerPhone,
    selling_price: sellingPrice,
    profit,
    payment_method: paymentMethod,
    payment_status: isAdminSale ? "Received" : "Pending Admin Confirmation",
    confirmed_by: isAdminSale ? profile.id : null,
    confirmed_at: isAdminSale ? now : null,
    sold_by: profile.id,
  } as ProfitRow;

  let saleResult = await supabase
    .from("sales")
    .insert(salePayload)
    .select("id")
    .single();

  if (saleResult.error && isMissingColumnError(saleResult.error)) {
    const legacyPayload = {
      phone_id: salePayload.phone_id,
      customer_name: salePayload.customer_name,
      customer_phone: salePayload.customer_phone,
      selling_price: salePayload.selling_price,
      profit: salePayload.profit,
      sold_by: profile.id,
    };
    saleResult = await supabase
      .from("sales")
      .insert(legacyPayload)
      .select("id")
      .single();
  }

  const { data: sale, error: saleErr } = saleResult;

  if (saleErr) return { ok: false, error: "Could not save this sale. Please try again." };

  const { error: updateErr } = await supabase
    .from("phones")
    .update({ status: "Sold", selling_price: sellingPrice })
    .eq("id", phone.id);

  if (updateErr) return { ok: false, error: "Could not mark this phone as sold. Please try again." };

  const actorName = formatPersonName(profile.full_name, profile.email);
  await logActivity({
    userId: profile.id,
    action: isAdminSale ? "PHONE_SOLD" : "PHONE_SOLD_PENDING_CONFIRMATION",
    phoneId: phone.id,
    description: isAdminSale
      ? `${actorName} sold phone IMEI ${imei}. Money received.`
      : `${actorName} sold phone IMEI ${imei}. Owner needs to confirm payment.`,
  });

  revalidatePath("/inventory");
  revalidatePath("/dashboard");
  revalidatePath("/notifications");
  revalidatePath("/reports");
  revalidatePath("/notifications");

  redirect(sale?.id ? `/receipt/${sale.id}` : "/inventory");
}
