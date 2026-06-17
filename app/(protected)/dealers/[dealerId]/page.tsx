import Link from "next/link";

import UpdateDealerRecordControls from "@/components/dealers/UpdateDealerRecordControls";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatCard } from "@/components/ui/StatCard";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { requireProfileRole } from "@/lib/auth/requireProfile";
import { formatMoney } from "@/lib/format/currency";
import { isMissingColumnError, logSupabaseWarning } from "@/lib/supabase/errors";
import { createSupabaseOperationalServerClient } from "@/lib/supabase/operationalServer";

type DealerRecord = {
  id: string;
  status: "With Dealer" | "Sold" | "Returned";
  agreed_price: number;
  amount_paid: number;
  date_given: string;
  date_completed: string | null;
  phones: { imei: string; brand: string; model: string } | null;
};
type LegacyDealerRecord = Omit<DealerRecord, "amount_paid">;

export default async function DealerProfilePage({
  params,
}: {
  params: Promise<{ dealerId: string }> | { dealerId: string };
}) {
  const profile = await requireProfileRole();
  const { dealerId } = await params;
  const supabase = await createSupabaseOperationalServerClient(profile);

  const { data: dealer, error: dealerErr } = await supabase
    .from("dealers")
    .select("id, name, phone_number, created_at")
    .eq("id", dealerId)
    .limit(1)
    .maybeSingle();

  const recordsResult = await supabase
    .from("dealer_records")
    .select("id, status, agreed_price, amount_paid, date_given, date_completed, phones:phone_id(imei, brand, model)")
    .eq("dealer_id", dealerId)
    .order("date_given", { ascending: false });

  let records: unknown = recordsResult.data;
  if (recordsResult.error && isMissingColumnError(recordsResult.error)) {
    logSupabaseWarning("[Dealer] amount_paid column missing; using legacy balance fallback. Apply migration 0004.", recordsResult.error);
    const legacy = await supabase
      .from("dealer_records")
      .select("id, status, agreed_price, date_given, date_completed, phones:phone_id(imei, brand, model)")
      .eq("dealer_id", dealerId)
      .order("date_given", { ascending: false });
    records = ((legacy.data ?? []) as unknown as LegacyDealerRecord[]).map((record) => ({ ...record, amount_paid: record.status === "Sold" ? record.agreed_price : 0 }));
  } else if (recordsResult.error) {
    logSupabaseWarning("[Dealer] Records failed", recordsResult.error);
  }

  if (dealerErr) logSupabaseWarning("[Dealer] Lookup failed", dealerErr);

  if (!dealer) {
    return (
      <div className="flex flex-col gap-4">
        <PageHeader title="Dealer not found" subtitle="The dealer profile could not be loaded." />
        <Link href="/dealers" className="inline-flex h-11 w-fit items-center rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground">
          Back to Dealers
        </Link>
      </div>
    );
  }

  const safeRecords = (records ?? []) as unknown as DealerRecord[];
  const current = safeRecords.filter((r) => r.status === "With Dealer");
  const sold = safeRecords.filter((r) => r.status === "Sold");
  const returned = safeRecords.filter((r) => r.status === "Returned");
  const totalValue = safeRecords.reduce((sum, r) => sum + Number(r.agreed_price ?? 0), 0);
  const totalPaid = safeRecords.reduce((sum, r) => sum + Number(r.amount_paid ?? 0), 0);
  const balance = safeRecords.reduce((sum, r) => sum + Math.max(Number(r.agreed_price ?? 0) - Number(r.amount_paid ?? 0), 0), 0);

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title={dealer.name} subtitle={dealer.phone_number} />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard title="Current phones" value={String(current.length)} />
        <StatCard title="Sold" value={String(sold.length)} />
        <StatCard title="Returned" value={String(returned.length)} />
        <StatCard title="Total value" value={formatMoney(totalValue)} />
        <StatCard title="Amount owed" value={formatMoney(balance)} detail={`Money received ${formatMoney(totalPaid)}`} />
      </div>

      <section className="rounded-lg border bg-card p-4 shadow-sm md:p-5">
        <div className="text-sm font-semibold">Dealer phones</div>
        <div className="mt-3 grid gap-3 xl:grid-cols-2">
          {safeRecords.map((record) => {
            const recordBalance = Math.max(Number(record.agreed_price ?? 0) - Number(record.amount_paid ?? 0), 0);
            return (
              <div key={record.id} className="rounded-lg border bg-background p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold">
                      {record.phones ? `${record.phones.brand} ${record.phones.model}` : "Phone"}
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">IMEI {record.phones?.imei ?? "Not available"}</div>
                  </div>
                  <StatusBadge status={record.status} />
                </div>
                <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
                  <div className="rounded-lg bg-card p-2">
                    <div className="text-muted-foreground">Agreed</div>
                    <div className="font-semibold">{formatMoney(record.agreed_price)}</div>
                  </div>
                  <div className="rounded-lg bg-card p-2">
                    <div className="text-muted-foreground">Money received</div>
                    <div className="font-semibold">{formatMoney(record.amount_paid)}</div>
                  </div>
                  <div className="rounded-lg bg-card p-2">
                    <div className="text-muted-foreground">Amount owed</div>
                    <div className="font-semibold">{formatMoney(recordBalance)}</div>
                  </div>
                </div>
                {record.status === "With Dealer" ? (
                  <div className="mt-3">
                    <UpdateDealerRecordControls dealerRecordId={record.id} defaultStatus={record.status} agreedPrice={Number(record.agreed_price)} />
                  </div>
                ) : null}
              </div>
            );
          })}
          {safeRecords.length === 0 ? (
            <div className="xl:col-span-2">
              <EmptyState title="No dealer phones" description="This dealer has not received any phones yet." />
            </div>
          ) : null}
        </div>
      </section>
    </div>
  );
}
