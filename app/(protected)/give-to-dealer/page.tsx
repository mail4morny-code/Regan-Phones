import Link from "next/link";

import GiveToDealerForm from "@/components/dealers/GiveToDealerForm";
import { MultiGiveToDealerForm } from "@/components/dealers/MultiGiveToDealerForm";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { requireProfileRole } from "@/lib/auth/requireProfile";
import { formatMoney } from "@/lib/format/currency";
import { createSupabaseOperationalServerClient } from "@/lib/supabase/operationalServer";
import { logSupabaseWarning } from "@/lib/supabase/errors";

type AvailablePhone = {
  id: string;
  imei: string;
  brand: string;
  model: string;
  storage: string | null;
  color: string | null;
  condition: string;
  selling_price: number;
  status: string;
  updated_at: string;
};

export default async function GiveToDealerPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>> | Record<string, string | string[] | undefined>;
}) {
  const profile = await requireProfileRole();

  const resolvedSearchParams = (await searchParams) ?? {};
  const imeiRaw = resolvedSearchParams.imei;
  const imei = Array.isArray(imeiRaw) ? imeiRaw[0] : imeiRaw;
  const qRaw = resolvedSearchParams.q;
  const q = (Array.isArray(qRaw) ? qRaw[0] : qRaw)?.trim() ?? "";

  const supabase = await createSupabaseOperationalServerClient(profile);

  if (imei) {
    const { data: phone, error } = await supabase
      .from("phones")
      .select("imei, brand, model, storage, color, condition, status, selling_price")
      .eq("imei", imei)
      .limit(1)
      .maybeSingle();
    if (error) logSupabaseWarning("[Give To Dealer] Phone lookup failed", error);

    return (
      <div className="flex flex-col gap-4">
        <PageHeader
          title="Give to Dealer"
          subtitle="Confirm the selected phone, then enter dealer details."
          actions={
            <Link href="/give-to-dealer" className="inline-flex h-11 items-center rounded-lg border bg-card px-4 text-sm font-semibold">
              Choose another phone
            </Link>
          }
        />

        {phone ? (
          <section className="rounded-lg border bg-card p-5 shadow-sm">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <div className="text-sm font-semibold">Selected phone</div>
                <div className="mt-2 text-lg font-bold">{phone.brand} {phone.model}</div>
                <div className="mt-1 text-sm text-muted-foreground">
                  IMEI {phone.imei}
                  {phone.storage ? ` / ${phone.storage}` : ""}
                  {phone.color ? ` / ${phone.color}` : ""}
                </div>
                <div className="mt-1 text-sm text-muted-foreground">
                  {phone.condition} / Listed {formatMoney(phone.selling_price)}
                </div>
              </div>
              <StatusBadge status={phone.status} />
            </div>
          </section>
        ) : (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
            Phone not found. Choose another available or returned phone.
          </div>
        )}

        {phone ? <GiveToDealerForm imei={imei} /> : null}
      </div>
    );
  }

  let query = supabase
    .from("phones")
    .select("id, imei, brand, model, storage, color, condition, selling_price, status, updated_at")
    .in("status", ["Available", "Returned"])
    .order("updated_at", { ascending: false })
    .limit(200);

  if (q.length > 0) {
    const needle = q.replaceAll(",", "");
    query = query.or(`imei.ilike.%${needle}%,brand.ilike.%${needle}%,model.ilike.%${needle}%,storage.ilike.%${needle}%,color.ilike.%${needle}%`);
  }

  const { data, error } = await query;
  if (error) logSupabaseWarning("[Give To Dealer] Available phones query failed", error);

  const phones = (data ?? []) as AvailablePhone[];

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Give to Dealer"
        subtitle="Click Give to Dealer on one or more available phones. The dealer form opens below your selection."
      />

      <form action="/give-to-dealer" className="rounded-lg border bg-card p-4 shadow-sm">
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            name="q"
            defaultValue={q}
            className="h-11 min-w-0 flex-1 rounded-lg border bg-background px-3 text-sm"
            placeholder="Search IMEI, brand, model, storage, or color"
          />
          <button className="h-11 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground">
            Search
          </button>
        </div>
      </form>

      {phones.length === 0 ? (
        <EmptyState
          title="No available phones to give to dealer"
          description="Add or return a phone first."
        />
      ) : null}

      {phones.length > 0 ? <MultiGiveToDealerForm phones={phones} /> : null}
    </div>
  );
}
