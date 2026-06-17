import Link from "next/link";

import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatCard } from "@/components/ui/StatCard";
import { requireProfileRole } from "@/lib/auth/requireProfile";
import { formatMoney } from "@/lib/format/currency";
import { isMissingColumnError, logSupabaseWarning } from "@/lib/supabase/errors";
import { createSupabaseOperationalServerClient } from "@/lib/supabase/operationalServer";

type Dealer = { id: string; name: string; phone_number: string; created_at: string };
type DealerRecord = { dealer_id: string; agreed_price: number; amount_paid: number; status: string };

export default async function DealersPage() {
  const profile = await requireProfileRole();
  const supabase = await createSupabaseOperationalServerClient(profile);

  const [{ data: dealers, error: dealerErr }, recordsResult] = await Promise.all([
    supabase.from("dealers").select("id, name, phone_number, created_at").order("created_at", { ascending: false }),
    supabase.from("dealer_records").select("dealer_id, agreed_price, amount_paid, status"),
  ]);

  let records = recordsResult.data;
  if (recordsResult.error && isMissingColumnError(recordsResult.error)) {
    logSupabaseWarning("[Dealers] amount_paid column missing; using legacy balance fallback. Apply migration 0004.", recordsResult.error);
    const legacy = await supabase.from("dealer_records").select("dealer_id, agreed_price, status");
    records = (legacy.data ?? []).map((record) => ({ ...record, amount_paid: record.status === "Sold" ? record.agreed_price : 0 }));
  } else if (recordsResult.error) {
    logSupabaseWarning("[Dealers] Records query failed", recordsResult.error);
  }
  if (dealerErr) logSupabaseWarning("[Dealers] Query failed", dealerErr);

  const safeDealers = (dealers ?? []) as Dealer[];
  const safeRecords = (records ?? []) as DealerRecord[];
  const totalBalance = safeRecords.reduce((sum, r) => sum + Math.max(Number(r.agreed_price ?? 0) - Number(r.amount_paid ?? 0), 0), 0);
  const activePhones = safeRecords.filter((r) => r.status === "With Dealer").length;

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title="Dealers" subtitle="Dealer profiles, phones with dealers, sold phones, returns, and money owed." />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard title="Dealers" value={String(safeDealers.length)} />
        <StatCard title="Phones with dealers" value={String(activePhones)} />
        <StatCard title="Amount owed" value={formatMoney(totalBalance)} />
        <StatCard title="Dealer transactions" value={String(safeRecords.length)} />
      </div>

      <section className="rounded-lg border bg-card p-4 shadow-sm md:p-5">
        <div className="text-sm font-semibold">Dealer list</div>
        <div className="mt-3 grid gap-3 xl:grid-cols-2">
          {safeDealers.map((dealer) => {
            const dealerRecords = safeRecords.filter((r) => r.dealer_id === dealer.id);
            const balance = dealerRecords.reduce((sum, r) => sum + Math.max(Number(r.agreed_price ?? 0) - Number(r.amount_paid ?? 0), 0), 0);
            return (
              <Link key={dealer.id} href={`/dealers/${dealer.id}`} className="rounded-lg border bg-background p-4 transition hover:border-gray-300 hover:shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold">{dealer.name}</div>
                    <div className="mt-1 text-xs text-muted-foreground">{dealer.phone_number}</div>
                  </div>
                  <div className="text-right text-xs text-muted-foreground">
                    <div>{dealerRecords.length} transaction{dealerRecords.length === 1 ? "" : "s"}</div>
                    <div className="mt-1 font-semibold text-foreground">{formatMoney(balance)}</div>
                  </div>
                </div>
              </Link>
            );
          })}
          {safeDealers.length === 0 ? (
            <div className="xl:col-span-2">
              <EmptyState title="No dealers yet" description="Give a phone to a dealer to create the first dealer profile." />
            </div>
          ) : null}
        </div>
      </section>
    </div>
  );
}
