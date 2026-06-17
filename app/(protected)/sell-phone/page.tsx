import Link from "next/link";

import { PageHeader } from "@/components/ui/PageHeader";
import { requireProfileRole } from "@/lib/auth/requireProfile";
import { formatMoney } from "@/lib/format/currency";
import { formatPhoneStatus } from "@/lib/format/display";
import SellPhoneForm from "@/components/phones/SellPhoneForm";
import { createSupabaseOperationalServerClient } from "@/lib/supabase/operationalServer";
import { logSupabaseWarning } from "@/lib/supabase/errors";

export default async function SellPhonePage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>> | Record<string, string | string[] | undefined>;
}) {
  const profile = await requireProfileRole();

  const resolvedSearchParams = (await searchParams) ?? {};
  const imeiRaw = resolvedSearchParams.imei;
  const imei = Array.isArray(imeiRaw) ? imeiRaw[0] : imeiRaw;

  if (!imei) {
    return (
      <div className="flex flex-col gap-4">
        <PageHeader title="Sell Phone" subtitle="Choose a phone from My Phones before recording a sale." />
        <Link href="/inventory" className="inline-flex h-11 w-fit items-center rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground">
          Open My Phones
        </Link>
      </div>
    );
  }

  const supabase = await createSupabaseOperationalServerClient(profile);
  const { data: phone, error } = await supabase
    .from("phones")
    .select("imei, brand, model, status, selling_price")
    .eq("imei", imei)
    .limit(1)
    .maybeSingle();
  if (error) logSupabaseWarning("[Sell Phone] Phone lookup failed", error);

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title="Sell Phone" subtitle="Record the sale and mark the phone as Sold." />

      {phone ? (
        <div className="rounded-lg border bg-card p-4 text-sm shadow-sm">
          <div className="font-semibold">{phone.brand} {phone.model}</div>
          <div className="mt-1 text-muted-foreground">IMEI {phone.imei} / Current status: {formatPhoneStatus(phone.status)} / Listed: {formatMoney(phone.selling_price)}</div>
        </div>
      ) : (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">Phone not found. Check the IMEI or return to My Phones.</div>
      )}

      <SellPhoneForm imei={imei} />
    </div>
  );
}
