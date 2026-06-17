"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { logActivity } from "@/lib/activity/logActivity";
import { requireProfileRole } from "@/lib/auth/requireProfile";
import { formatMoneyExact } from "@/lib/format/currency";
import { formatPersonName } from "@/lib/format/display";
import { isMissingColumnError } from "@/lib/supabase/errors";
import { createSupabaseOperationalServerClient } from "@/lib/supabase/operationalServer";
import type { Database } from "@/lib/supabase/types";

function parseId(v: string | null) {
  return (v ?? "").trim();
}

function parseMoney(value: string) {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return null;
  return n;
}

type DealerRecordForUpdate = {
  id: string;
  dealer_id: string;
  phone_id: string;
  status: "With Dealer" | "Sold" | "Returned";
  agreed_price: number;
  phones: { imei?: string; cost_price?: number } | Array<{ imei?: string; cost_price?: number }> | null;
  dealers: { name?: string } | Array<{ name?: string }> | null;
};
type SaleInsert = Database["public"]["Tables"]["sales"]["Insert"];

export async function updateDealerRecordAction(
  prevState: unknown,
  formData: FormData
): Promise<{ ok: true } | { ok: false; error: string }> {
  const dealerRecordId = parseId(String(formData.get("dealer_record_id") ?? null));
  const nextStatusRaw = String(formData.get("next_status") ?? "").trim();
  const amountPaidRaw = String(formData.get("amount_paid") ?? "").trim();
  const nextStatus = nextStatusRaw as "Sold" | "Returned";

  if (!dealerRecordId) return { ok: false, error: "Choose a dealer phone first." };
  if (!["Sold", "Returned"].includes(nextStatusRaw)) return { ok: false, error: "Invalid status." };

  const profile = await requireProfileRole();
  const supabase = await createSupabaseOperationalServerClient(profile);

  const { data: record, error: recErr } = await supabase
    .from("dealer_records")
    .select("id, dealer_id, phone_id, status, agreed_price, phones:phone_id(imei, cost_price), dealers:dealer_id(name)")
    .eq("id", dealerRecordId)
    .limit(1)
    .maybeSingle();

  if (recErr || !record) return { ok: false, error: "Dealer phone not found." };

  const dealerRecord = record as unknown as DealerRecordForUpdate;
  if (dealerRecord.status !== "With Dealer") {
    return { ok: false, error: "This dealer phone is already completed." };
  }

  const amountPaid = nextStatus === "Sold"
    ? parseMoney(amountPaidRaw || String(dealerRecord.agreed_price ?? 0))
    : 0;

  if (amountPaid === null) return { ok: false, error: "Amount paid is invalid." };
  if (nextStatus === "Sold" && amountPaid > Number(dealerRecord.agreed_price ?? 0)) {
    return { ok: false, error: "Amount paid cannot exceed agreed price." };
  }

  const phone = Array.isArray(dealerRecord.phones) ? dealerRecord.phones[0] : dealerRecord.phones;
  const dealer = Array.isArray(dealerRecord.dealers) ? dealerRecord.dealers[0] : dealerRecord.dealers;
  const actorName = formatPersonName(profile.full_name, profile.email);
  const dealerName = dealer?.name ?? "the dealer";
  const phoneLabel = phone?.imei ?? dealerRecord.phone_id;
  const completedAt = new Date().toISOString();

  let updateResult = await supabase
    .from("dealer_records")
    .update({ status: nextStatus, amount_paid: amountPaid, date_completed: completedAt })
    .eq("id", dealerRecordId);
  if (updateResult.error && isMissingColumnError(updateResult.error)) {
    updateResult = await supabase
      .from("dealer_records")
      .update({ status: nextStatus, date_completed: completedAt })
      .eq("id", dealerRecordId);
  }

  const { error: updateErr } = updateResult;
  if (updateErr) return { ok: false, error: "Could not update this dealer phone. Please try again." };

  if (nextStatus === "Sold") {
    const agreedPrice = Number(dealerRecord.agreed_price ?? 0);
    const costPrice = Number(phone?.cost_price ?? 0);
    const isAdminSale = profile.role === "admin";
    const confirmedAt = new Date().toISOString();
    const salePayload: SaleInsert = {
      phone_id: dealerRecord.phone_id,
      customer_name: "Dealer sale",
      customer_phone: null,
      selling_price: agreedPrice,
      profit: agreedPrice - costPrice,
      payment_method: "Dealer",
      payment_status: isAdminSale ? "Received" : "Pending Admin Confirmation",
      confirmed_by: isAdminSale ? profile.id : null,
      confirmed_at: isAdminSale ? confirmedAt : null,
      sold_by: profile.id,
    };
    let saleResult = await supabase.from("sales").insert(salePayload);
    if (saleResult.error && isMissingColumnError(saleResult.error)) {
      const legacyPayload = {
        phone_id: salePayload.phone_id,
        customer_name: salePayload.customer_name,
        customer_phone: salePayload.customer_phone,
        selling_price: salePayload.selling_price,
        profit: salePayload.profit,
        sold_by: profile.id,
      };
      saleResult = await supabase.from("sales").insert(legacyPayload);
    }

    const { error: saleErr } = saleResult;
    if (saleErr) return { ok: false, error: "Could not save this dealer sale. Please try again." };
  }

  const phoneStatus = nextStatus === "Sold" ? "Sold" : "Returned";
  const { error: phoneErr } = await supabase
    .from("phones")
    .update({ status: phoneStatus })
    .eq("id", dealerRecord.phone_id);

  if (phoneErr) return { ok: false, error: "Could not update this phone. Please try again." };

  await logActivity({
    userId: profile.id,
    action: nextStatus === "Sold" ? "PHONE_DEALER_SOLD" : "PHONE_RETURNED",
    phoneId: dealerRecord.phone_id,
    dealerId: dealerRecord.dealer_id,
    description:
      nextStatus === "Sold"
        ? profile.role === "admin"
          ? `${actorName} marked ${dealerName}'s phone IMEI ${phoneLabel} as sold. Money received: ${formatMoneyExact(amountPaid)} of ${formatMoneyExact(dealerRecord.agreed_price)}.`
          : `${actorName} marked ${dealerName}'s phone IMEI ${phoneLabel} as sold. Owner needs to confirm payment.`
        : `${actorName} marked ${dealerName}'s phone IMEI ${phoneLabel} as returned to the shop.`,
  });

  revalidatePath("/dealer-phones");
  revalidatePath(`/dealers/${dealerRecord.dealer_id}`);
  revalidatePath("/dealers");
  revalidatePath("/inventory");
  revalidatePath("/dashboard");
  revalidatePath("/reports");

  redirect("/dealer-phones");
}
