import Link from "next/link";

import UpdateDealerRecordControls from "@/components/dealers/UpdateDealerRecordControls";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { requireProfileRole } from "@/lib/auth/requireProfile";
import { formatMoney } from "@/lib/format/currency";
import { isOverdue24Hours, timeSince } from "@/lib/format/time";
import { isMissingColumnError, logSupabaseWarning } from "@/lib/supabase/errors";
import { createSupabaseOperationalServerClient } from "@/lib/supabase/operationalServer";

type DealerRecord = {
  id: string;
  batch_id: string | null;
  status: string;
  agreed_price: number;
  amount_paid: number;
  date_given: string;
  date_completed: string | null;
  dealers: { name: string; phone_number: string } | null;
  phones: { imei: string; brand: string; model: string } | null;
};
type LegacyDealerRecord = Omit<DealerRecord, "amount_paid" | "batch_id">;

function whatsappLink(phoneNumber: string | undefined) {
  const digits = (phoneNumber ?? "").replace(/\D/g, "");
  if (!digits) return null;
  return `https://wa.me/${digits}`;
}

export default async function DealerPhonesPage() {
  const profile = await requireProfileRole();

  const supabase = await createSupabaseOperationalServerClient(profile);
  const recordsResult = await supabase
    .from("dealer_records")
    .select("id, batch_id, status, agreed_price, amount_paid, date_given, date_completed, dealers:dealer_id(name, phone_number), phones:phone_id(imei, brand, model)")
    .order("date_given", { ascending: false })
    .limit(300);
  let data: unknown = recordsResult.data;
  if (recordsResult.error && isMissingColumnError(recordsResult.error)) {
    logSupabaseWarning("[Dealer Phones] batch/amount columns missing; using legacy fallback. Apply migrations 0004 and 0005.", recordsResult.error);
    const legacy = await supabase
      .from("dealer_records")
      .select("id, status, agreed_price, date_given, date_completed, dealers:dealer_id(name, phone_number), phones:phone_id(imei, brand, model)")
      .order("date_given", { ascending: false })
      .limit(300);
    data = ((legacy.data ?? []) as LegacyDealerRecord[]).map((record) => ({
      ...record,
      batch_id: null,
      amount_paid: record.status === "Sold" ? record.agreed_price : 0,
    }));
  } else if (recordsResult.error) {
    logSupabaseWarning("[Dealer Phones] Query failed", recordsResult.error);
  }

  const records = ((data ?? []) as unknown as DealerRecord[]).sort((a, b) => {
    const aOverdue = a.status === "With Dealer" && isOverdue24Hours(a.date_given);
    const bOverdue = b.status === "With Dealer" && isOverdue24Hours(b.date_given);
    if (aOverdue !== bOverdue) return aOverdue ? -1 : 1;
    return new Date(b.date_given).getTime() - new Date(a.date_given).getTime();
  });

  const groups = Array.from(records.reduce((map, record) => {
    const key = record.batch_id ?? `${record.dealers?.phone_number ?? "unknown"}-${record.date_given}`;
    const current = map.get(key) ?? [];
    current.push(record);
    map.set(key, current);
    return map;
  }, new Map<string, DealerRecord[]>()).entries());

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title="Dealer Phones" subtitle="Phones given to dealers, grouped by each handover, with overdue follow-ups first." />

      {groups.length === 0 ? (
        <EmptyState title="No dealer phones yet" description="Give one or more phones to a dealer to start tracking them here." />
      ) : null}

      <div className="grid gap-4">
        {groups.map(([key, group]) => {
          const first = group[0];
          const overdue = group.some((record) => record.status === "With Dealer" && isOverdue24Hours(record.date_given));
          const totalAgreed = group.reduce((sum, record) => sum + Number(record.agreed_price ?? 0), 0);
          const currentCount = group.filter((record) => record.status === "With Dealer").length;
          const soldCount = group.filter((record) => record.status === "Sold").length;
          const returnedCount = group.filter((record) => record.status === "Returned").length;
          const waLink = whatsappLink(first?.dealers?.phone_number);

          return (
            <section key={key} className={overdue ? "rounded-lg border border-amber-300 bg-amber-50/60 p-4 shadow-sm md:p-5" : "rounded-lg border bg-card p-4 shadow-sm md:p-5"}>
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-base font-semibold">{first?.dealers?.name ?? "Unknown dealer"}</h2>
                    {overdue ? <span className="rounded-full bg-amber-100 px-2 py-1 text-xs font-semibold text-amber-800">Over 24 hours</span> : null}
                  </div>
                  <div className="mt-1 text-sm text-muted-foreground">{first?.dealers?.phone_number ?? "No phone number"}</div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    Given {new Date(first?.date_given ?? "").toLocaleString("en-GB")} / {timeSince(first?.date_given)}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4 lg:min-w-[520px]">
                  <div className="rounded-lg bg-background p-3">
                    <div className="text-xs text-muted-foreground">Phones</div>
                    <div className="font-semibold">{group.length}</div>
                  </div>
                  <div className="rounded-lg bg-background p-3">
                    <div className="text-xs text-muted-foreground">Agreed value</div>
                    <div className="font-semibold">{formatMoney(totalAgreed)}</div>
                  </div>
                  <div className="rounded-lg bg-background p-3">
                    <div className="text-xs text-muted-foreground">Open</div>
                    <div className="font-semibold">{currentCount}</div>
                  </div>
                  <div className="rounded-lg bg-background p-3">
                    <div className="text-xs text-muted-foreground">Done</div>
                    <div className="font-semibold">{soldCount} sold / {returnedCount} returned</div>
                  </div>
                </div>
              </div>

              <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                {waLink ? (
                  <a href={waLink} target="_blank" rel="noreferrer" className="inline-flex h-10 items-center justify-center rounded-lg border bg-card px-3 text-sm font-semibold">
                    WhatsApp dealer
                  </a>
                ) : null}
                {first?.batch_id ? (
                  <Link href={`/dealer-receipt/${first.batch_id}`} className="inline-flex h-10 items-center justify-center rounded-lg border bg-card px-3 text-sm font-semibold">
                    Generate receipt
                  </Link>
                ) : null}
              </div>

              <div className="mt-4 grid gap-3 xl:grid-cols-2">
                {group.map((record) => {
                  const recordOverdue = record.status === "With Dealer" && isOverdue24Hours(record.date_given);
                  return (
                    <article key={record.id} className={recordOverdue ? "rounded-lg border border-amber-300 bg-background p-4" : "rounded-lg border bg-background p-4"}>
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <div className="text-sm font-semibold">
                            {record.phones ? `${record.phones.brand} ${record.phones.model}` : "Phone record"}
                          </div>
                          <div className="mt-1 text-xs text-muted-foreground">IMEI {record.phones?.imei ?? "Not available"}</div>
                          <div className="mt-1 text-xs text-muted-foreground">Since given: {timeSince(record.date_given)}</div>
                        </div>
                        <div className="flex flex-row flex-wrap gap-2 sm:flex-col sm:items-end">
                          <StatusBadge status={record.status} />
                          {recordOverdue ? <span className="rounded-full bg-amber-100 px-2 py-1 text-[11px] font-semibold text-amber-800">Over 24 hours</span> : null}
                        </div>
                      </div>

                      <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                        <div className="rounded-lg bg-card p-3">
                          <div>Agreed price</div>
                          <div className="mt-1 font-semibold text-foreground">{formatMoney(record.agreed_price)}</div>
                        </div>
                        <div className="rounded-lg bg-card p-3">
                          <div>Date given</div>
                          <div className="mt-1 font-semibold text-foreground">{new Date(record.date_given).toLocaleDateString("en-GB")}</div>
                        </div>
                      </div>

                      <div className="mt-3">
                        {record.status === "With Dealer" ? (
                          <UpdateDealerRecordControls dealerRecordId={record.id} defaultStatus={record.status} agreedPrice={Number(record.agreed_price)} />
                        ) : (
                          <div className="rounded-lg border bg-card p-3 text-xs text-muted-foreground">
                            Completed {record.date_completed ? new Date(record.date_completed).toLocaleDateString("en-GB") : ""}
                          </div>
                        )}
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
