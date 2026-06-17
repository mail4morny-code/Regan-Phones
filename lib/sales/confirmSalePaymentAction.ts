"use server";

import { revalidatePath } from "next/cache";

import { logActivity } from "@/lib/activity/logActivity";
import { requireProfileRole } from "@/lib/auth/requireProfile";
import { createSupabaseOperationalServerClient } from "@/lib/supabase/operationalServer";
import { logSupabaseWarning } from "@/lib/supabase/errors";

type SaleForConfirmation = {
  id: string;
  phone_id: string;
  selling_price: number;
  payment_status: "Pending Admin Confirmation" | "Received";
  phones: { imei: string; brand: string; model: string } | Array<{ imei: string; brand: string; model: string }> | null;
};

export async function confirmSalePaymentAction(formData: FormData) {
  const profile = await requireProfileRole(["admin"]);
  const saleId = String(formData.get("sale_id") ?? "").trim();
  if (!saleId) return;

  const supabase = await createSupabaseOperationalServerClient(profile);
  const { data, error: lookupErr } = await supabase
    .from("sales")
    .select("id, phone_id, selling_price, payment_status, phones:phone_id(imei, brand, model)")
    .eq("id", saleId)
    .limit(1)
    .maybeSingle();

  const sale = data as unknown as SaleForConfirmation | null;

  if (lookupErr || !sale) {
    logSupabaseWarning("[Sales] Money confirmation lookup failed", lookupErr);
    return;
  }

  if (sale.payment_status === "Received") return;

  const confirmedAt = new Date().toISOString();
  const { error } = await supabase
    .from("sales")
    .update({
      payment_status: "Received",
      confirmed_by: profile.id,
      confirmed_at: confirmedAt,
    })
    .eq("id", saleId);

  if (error) {
    logSupabaseWarning("[Sales] Money confirmation failed", error);
    return;
  }

  const phone = Array.isArray(sale.phones) ? sale.phones[0] : sale.phones;
  await logActivity({
    userId: profile.id,
    action: "SALE_PAYMENT_CONFIRMED",
    phoneId: sale.phone_id,
    description: `Owner confirmed money received for ${phone ? `${phone.brand} ${phone.model} IMEI ${phone.imei}` : `sale ${saleId}`}.`,
  });

  revalidatePath("/dashboard");
  revalidatePath("/notifications");
  revalidatePath("/reports");
  revalidatePath("/notifications");
}
