import Link from "next/link";

import { EditPhoneForm } from "@/components/phones/EditPhoneForm";
import { PageHeader } from "@/components/ui/PageHeader";
import { requireProfileRole } from "@/lib/auth/requireProfile";
import { createSupabaseAppServerClient } from "@/lib/supabase/appServer";
import { isMissingColumnError, logSupabaseWarning } from "@/lib/supabase/errors";

export default async function EditPhonePage({
  params,
}: {
  params: Promise<{ imei: string }> | { imei: string };
}) {
  await requireProfileRole(["admin"]);

  const { imei } = await params;
  const supabase = await createSupabaseAppServerClient();
  const phoneResult = await supabase
    .from("phones")
    .select("id, imei, brand, model, storage, color, battery_health, condition, cost_price, selling_price, status")
    .eq("imei", imei)
    .limit(1)
    .maybeSingle();
  let phone = phoneResult.data;

  if (phoneResult.error && isMissingColumnError(phoneResult.error)) {
    logSupabaseWarning("[Edit Phone] battery_health column missing; using legacy fallback. Apply migration 0005.", phoneResult.error);
    const legacy = await supabase
      .from("phones")
      .select("id, imei, brand, model, storage, color, condition, cost_price, selling_price, status")
      .eq("imei", imei)
      .limit(1)
      .maybeSingle();
    phone = legacy.data ? { ...legacy.data, battery_health: null } : null;
  } else if (phoneResult.error) {
    logSupabaseWarning("[Edit Phone] Phone lookup failed", phoneResult.error);
  }

  if (!phone) {
    return (
      <div className="flex flex-col gap-4">
        <PageHeader title="Phone not found" subtitle="The IMEI does not match any phone in stock." />
        <Link href="/inventory" className="inline-flex h-11 w-fit items-center rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground">
          Back to My Phones
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title="Edit Phone" subtitle={`${phone.brand} ${phone.model} / IMEI ${phone.imei}`} />
      <EditPhoneForm phone={phone} />
    </div>
  );
}
