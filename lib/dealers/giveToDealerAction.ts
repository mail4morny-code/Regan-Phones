"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { logActivity } from "@/lib/activity/logActivity";
import { requireProfileRole } from "@/lib/auth/requireProfile";
import { formatMoneyExact } from "@/lib/format/currency";
import { formatPersonName } from "@/lib/format/display";
import { isMissingColumnError } from "@/lib/supabase/errors";
import { createSupabaseOperationalServerClient } from "@/lib/supabase/operationalServer";

function parseMoney(value: string) {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return null;
  return n;
}

function parseDate(value: string) {
  if (!value) return new Date();
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

export async function giveToDealerAction(
  prevState: unknown,
  formData: FormData
): Promise<{ ok: true } | { ok: false; error: string }> {
  const imei = String(formData.get("imei") ?? "").trim();
  const dealerName = String(formData.get("dealer_name") ?? "").trim();
  const dealerPhone = String(formData.get("dealer_phone") ?? "").trim();
  const agreedPriceRaw = String(formData.get("agreed_price") ?? "").trim();
  const dateGivenRaw = String(formData.get("date_given") ?? "").trim();

  if (!imei) return { ok: false, error: "IMEI is required." };
  if (!dealerName) return { ok: false, error: "Dealer name is required." };
  if (!dealerPhone) return { ok: false, error: "Dealer phone number is required." };

  const agreedPrice = parseMoney(agreedPriceRaw);
  if (agreedPrice === null) return { ok: false, error: "Agreed price is invalid." };
  const dateGiven = parseDate(dateGivenRaw);
  if (!dateGiven) return { ok: false, error: "Date given is invalid." };

  const profile = await requireProfileRole();
  const supabase = await createSupabaseOperationalServerClient(profile);

  const { data: phone, error: phoneErr } = await supabase
    .from("phones")
    .select("id, imei, status")
    .eq("imei", imei)
    .limit(1)
    .maybeSingle();

  if (phoneErr || !phone) return { ok: false, error: "Phone not found." };
  if (phone.status !== "Available" && phone.status !== "Returned") {
    return { ok: false, error: "Only Available or Returned phones can be given to dealers." };
  }

  const { data: existingDealer } = await supabase
    .from("dealers")
    .select("id")
    .eq("phone_number", dealerPhone)
    .limit(1)
    .maybeSingle();

  let dealerId = existingDealer?.id;
  if (!dealerId) {
    const { data: insertedDealer, error: dealerInsertErr } = await supabase
      .from("dealers")
      .insert({ name: dealerName, phone_number: dealerPhone })
      .select("id")
      .single();

    if (dealerInsertErr || !insertedDealer) {
      return { ok: false, error: "Could not add this dealer. Please try again." };
    }
    dealerId = insertedDealer.id;
  }

  const recordPayload = {
    dealer_id: dealerId,
    phone_id: phone.id,
    agreed_price: agreedPrice,
    amount_paid: 0,
    status: "With Dealer" as const,
    date_given: dateGiven.toISOString(),
    created_by: profile.id,
  };

  let recordResult = await supabase.from("dealer_records").insert(recordPayload);
  if (recordResult.error && isMissingColumnError(recordResult.error)) {
    const legacyPayload = {
      dealer_id: recordPayload.dealer_id,
      phone_id: recordPayload.phone_id,
      agreed_price: recordPayload.agreed_price,
      status: recordPayload.status,
      date_given: recordPayload.date_given,
      created_by: recordPayload.created_by,
    };
    recordResult = await supabase.from("dealer_records").insert(legacyPayload);
  }

  const { error: recordErr } = recordResult;

  if (recordErr) return { ok: false, error: "Could not give this phone to the dealer. Please try again." };

  const { error: updateErr } = await supabase
    .from("phones")
    .update({ status: "With Dealer" })
    .eq("id", phone.id);

  if (updateErr) return { ok: false, error: "Could not move this phone to dealer stock. Please try again." };

  await logActivity({
    userId: profile.id,
    action: "PHONE_GIVEN",
    phoneId: phone.id,
    dealerId,
    description: `${formatPersonName(profile.full_name, profile.email)} gave phone IMEI ${imei} to ${dealerName}. Agreed: ${formatMoneyExact(agreedPrice)}`,
  });

  revalidatePath("/inventory");
  revalidatePath("/dashboard");
  revalidatePath("/dealer-phones");
  revalidatePath("/dealers");
  revalidatePath(`/dealers/${dealerId}`);
  revalidatePath("/notifications");

  redirect("/dealer-phones");
}

export async function giveMultipleToDealerAction(
  prevState: unknown,
  formData: FormData
): Promise<{ ok: true } | { ok: false; error: string }> {
  const phoneIds = formData.getAll("phone_ids").map((value) => String(value).trim()).filter(Boolean);
  const dealerName = String(formData.get("dealer_name") ?? "").trim();
  const dealerPhone = String(formData.get("dealer_phone") ?? "").trim();
  const dateGivenRaw = String(formData.get("date_given") ?? "").trim();

  if (phoneIds.length === 0) return { ok: false, error: "Select at least one phone." };
  if (!dealerName) return { ok: false, error: "Dealer name is required." };
  if (!dealerPhone) return { ok: false, error: "Dealer phone number is required." };

  const dateGiven = parseDate(dateGivenRaw);
  if (!dateGiven) return { ok: false, error: "Date given is invalid." };

  const profile = await requireProfileRole();
  const supabase = await createSupabaseOperationalServerClient(profile);

  const { data: phones, error: phonesErr } = await supabase
    .from("phones")
    .select("id, imei, status")
    .in("id", phoneIds);

  if (phonesErr) return { ok: false, error: "Could not load the selected phones. Please try again." };
  if (!phones || phones.length !== phoneIds.length) return { ok: false, error: "Some selected phones could not be found." };

  const unavailable = phones.filter((phone) => phone.status !== "Available" && phone.status !== "Returned");
  if (unavailable.length > 0) {
    return { ok: false, error: "Only Available or Returned phones can be given to dealers." };
  }

  const agreedPrices = new Map<string, number>();
  for (const id of phoneIds) {
    const agreedPrice = parseMoney(String(formData.get(`agreed_price_${id}`) ?? ""));
    if (agreedPrice === null) return { ok: false, error: "Every selected phone needs a valid agreed price." };
    agreedPrices.set(id, agreedPrice);
  }

  const { data: existingDealer } = await supabase
    .from("dealers")
    .select("id")
    .eq("phone_number", dealerPhone)
    .limit(1)
    .maybeSingle();

  let dealerId = existingDealer?.id;
  if (!dealerId) {
    const { data: insertedDealer, error: dealerInsertErr } = await supabase
      .from("dealers")
      .insert({ name: dealerName, phone_number: dealerPhone })
      .select("id")
      .single();

    if (dealerInsertErr || !insertedDealer) {
      return { ok: false, error: "Could not add this dealer. Please try again." };
    }
    dealerId = insertedDealer.id;
  }

  let batchId: string | null = null;
  const batchResult = await supabase
    .from("dealer_batches")
    .insert({
      dealer_id: dealerId,
      created_by: profile.id,
      date_given: dateGiven.toISOString(),
    })
    .select("id")
    .single();

  if (batchResult.error && !isMissingColumnError(batchResult.error)) {
    const message = String(batchResult.error.message ?? "").toLowerCase();
    if (!message.includes("dealer_batches") && !message.includes("schema cache")) {
      return { ok: false, error: "Could not start this dealer handover. Please try again." };
    }
  } else if (batchResult.data) {
    batchId = batchResult.data.id;
  }

  const recordPayloads = phones.map((phone) => ({
    batch_id: batchId,
    dealer_id: dealerId,
    phone_id: phone.id,
    agreed_price: agreedPrices.get(phone.id) ?? 0,
    amount_paid: 0,
    status: "With Dealer" as const,
    date_given: dateGiven.toISOString(),
    created_by: profile.id,
  }));

  let recordResult = await supabase.from("dealer_records").insert(recordPayloads);
  if (recordResult.error && isMissingColumnError(recordResult.error)) {
    const legacyPayloads = recordPayloads.map((record) => {
      const { amount_paid, batch_id, ...payload } = record;
      void amount_paid;
      void batch_id;
      return payload;
    });
    recordResult = await supabase.from("dealer_records").insert(legacyPayloads);
  }

  if (recordResult.error) {
    return { ok: false, error: "Could not give these phones to the dealer. Please try again." };
  }

  const { error: updateErr } = await supabase
    .from("phones")
    .update({ status: "With Dealer" })
    .in("id", phoneIds);

  if (updateErr) return { ok: false, error: "Could not move these phones to dealer stock. Please try again." };

  const totalAgreed = Array.from(agreedPrices.values()).reduce((sum, value) => sum + value, 0);
  await logActivity({
    userId: profile.id,
    action: "DEALER_BATCH_GIVEN",
    dealerId,
    description: `${formatPersonName(profile.full_name, profile.email)} gave ${phones.length} phone${phones.length === 1 ? "" : "s"} to ${dealerName}. Total agreed: ${formatMoneyExact(totalAgreed)}`,
  });

  revalidatePath("/inventory");
  revalidatePath("/dashboard");
  revalidatePath("/dealer-phones");
  revalidatePath("/dealers");
  revalidatePath(`/dealers/${dealerId}`);
  revalidatePath("/notifications");

  redirect("/dealer-phones");
}
