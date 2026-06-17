import Link from "next/link";

import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatCard } from "@/components/ui/StatCard";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { requireProfileRole } from "@/lib/auth/requireProfile";
import { formatMoney, formatMoneyExact } from "@/lib/format/currency";
import { formatActivityAction, formatCondition, formatPaymentStatus, formatPhoneStatus } from "@/lib/format/display";
import { archivePhoneAction, markPhoneDamagedAction } from "@/lib/phones/phoneManagementActions";
import { isMissingColumnError, logSupabaseWarning } from "@/lib/supabase/errors";
import { createSupabaseOperationalServerClient } from "@/lib/supabase/operationalServer";

type DealerHistory = {
  id: string;
  status: string;
  agreed_price: number;
  amount_paid: number;
  date_given: string;
  date_completed: string | null;
  dealers: { id: string; name: string; phone_number: string } | null;
};
type LegacyDealerHistory = Omit<DealerHistory, "amount_paid">;
type PhoneDetails = {
  id: string;
  imei: string;
  brand: string;
  model: string;
  storage: string | null;
  color: string | null;
  battery_health: string | null;
  condition: string;
  cost_price: number;
  selling_price: number;
  status: string;
  updated_at: string;
};

export default async function PhoneDetailsPage({
  params,
}: {
  params: Promise<{ imei: string }> | { imei: string };
}) {
  const profile = await requireProfileRole();
  const isAdmin = profile.role === "admin";

  const supabase = await createSupabaseOperationalServerClient(profile);
  const { imei } = await params;
  const phoneResult = await supabase
    .from("phones")
    .select("id, imei, brand, model, storage, color, battery_health, condition, cost_price, selling_price, status, updated_at")
    .eq("imei", imei)
    .limit(1)
    .maybeSingle();
  let phone = phoneResult.data as PhoneDetails | null;
  if (phoneResult.error && isMissingColumnError(phoneResult.error)) {
    logSupabaseWarning("[Phone Details] battery_health column missing; using legacy fallback. Apply migration 0005.", phoneResult.error);
    const legacy = await supabase
      .from("phones")
      .select("id, imei, brand, model, storage, color, condition, cost_price, selling_price, status, updated_at")
      .eq("imei", imei)
      .limit(1)
      .maybeSingle();
    phone = legacy.data ? { ...legacy.data, battery_health: null } : null;
  } else if (phoneResult.error) {
    logSupabaseWarning("[Phone Details] Phone lookup failed", phoneResult.error);
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

  const [salesResult, dealerRecordsResult, { data: activity }] = await Promise.all([
    isAdmin
      ? supabase
          .from("sales")
          .select("id, customer_name, customer_phone, selling_price, profit, payment_method, payment_status, sold_at")
          .eq("phone_id", phone.id)
          .order("sold_at", { ascending: false })
      : Promise.resolve({ data: [], error: null }),
    supabase
      .from("dealer_records")
      .select("id, status, agreed_price, amount_paid, date_given, date_completed, dealers:dealer_id(id, name, phone_number)")
      .eq("phone_id", phone.id)
      .order("date_given", { ascending: false }),
    supabase
      .from("activity_log")
      .select("id, action, description, created_at")
      .eq("phone_id", phone.id)
      .order("created_at", { ascending: false })
      .limit(20),
  ]);

  let sales = salesResult.data;
  if (isAdmin && salesResult.error && isMissingColumnError(salesResult.error)) {
    logSupabaseWarning("[Phone Details] sale payment columns missing; using legacy fallback. Apply migrations 0004 and 0008.", salesResult.error);
    const legacy = await supabase
      .from("sales")
      .select("id, customer_name, customer_phone, selling_price, profit, sold_at")
      .eq("phone_id", phone.id)
      .order("sold_at", { ascending: false });
    sales = (legacy.data ?? []).map((sale) => ({ ...sale, payment_method: "Cash", payment_status: "Received" }));
  } else if (isAdmin && salesResult.error) {
    logSupabaseWarning("[Phone Details] Sales history failed", salesResult.error);
  }

  let dealerRecords: unknown = dealerRecordsResult.data;
  if (dealerRecordsResult.error && isMissingColumnError(dealerRecordsResult.error)) {
    logSupabaseWarning("[Phone Details] amount_paid column missing; using legacy dealer history fallback. Apply migration 0004.", dealerRecordsResult.error);
    const legacy = await supabase
      .from("dealer_records")
      .select("id, status, agreed_price, date_given, date_completed, dealers:dealer_id(id, name, phone_number)")
      .eq("phone_id", phone.id)
      .order("date_given", { ascending: false });
    dealerRecords = ((legacy.data ?? []) as unknown as LegacyDealerHistory[]).map((record) => ({ ...record, amount_paid: record.status === "Sold" ? record.agreed_price : 0 }));
  } else if (dealerRecordsResult.error) {
    logSupabaseWarning("[Phone Details] Dealer history failed", dealerRecordsResult.error);
  }

  const safeDealerRecords = (dealerRecords ?? []) as unknown as DealerHistory[];

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title={`${phone.brand} ${phone.model}`}
        subtitle={`IMEI ${phone.imei}`}
        actions={<StatusBadge status={phone.status} />}
      />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard title="Status" value={formatPhoneStatus(phone.status)} />
        <StatCard title="Condition" value={formatCondition(phone.condition)} />
        {isAdmin ? <StatCard title="Cost price" value={formatMoney(phone.cost_price)} /> : null}
        <StatCard title="Selling price" value={formatMoney(phone.selling_price)} />
        {phone.brand.toLowerCase() === "apple" ? <StatCard title="Battery Health" value={phone.battery_health || "Not set"} /> : null}
      </div>

      <section className="rounded-lg border bg-card p-5 shadow-sm">
        <div className="text-sm font-semibold">Quick actions</div>
        <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-5">
          <Link href={`/sell-phone?imei=${encodeURIComponent(phone.imei)}`} className="flex h-11 items-center justify-center rounded-lg bg-primary px-4 font-semibold text-primary-foreground">
            Sell Phone
          </Link>
          <Link href={`/give-to-dealer?imei=${encodeURIComponent(phone.imei)}`} className="flex h-11 items-center justify-center rounded-lg border bg-card px-4 font-semibold">
            Give To Dealer
          </Link>
          {isAdmin ? (
            <Link href={`/edit-phone/${encodeURIComponent(phone.imei)}`} className="flex h-11 items-center justify-center rounded-lg border bg-card px-4 font-semibold">
              Edit Phone
            </Link>
          ) : null}
          <form action={markPhoneDamagedAction}>
            <input type="hidden" name="phone_id" value={phone.id} />
            <button className="flex h-11 w-full items-center justify-center rounded-lg border bg-card px-4 font-semibold">
              Mark Damaged
            </button>
          </form>
          {profile.role === "admin" ? (
            <form action={archivePhoneAction}>
              <input type="hidden" name="phone_id" value={phone.id} />
              <button className="flex h-11 w-full items-center justify-center rounded-lg border border-red-200 bg-red-50 px-4 font-semibold text-red-700">
                Remove from Active Stock
              </button>
            </form>
          ) : null}
        </div>
      </section>

      <section className="rounded-lg border bg-card p-5 shadow-sm">
        <div className="text-sm font-semibold">Phone details</div>
        <dl className="mt-4 grid grid-cols-1 gap-3 text-sm sm:grid-cols-3">
          <div>
            <dt className="text-xs text-muted-foreground">Storage</dt>
            <dd className="font-medium">{phone.storage ?? "Not set"}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Color</dt>
            <dd className="font-medium">{phone.color ?? "Not set"}</dd>
          </div>
          {phone.brand.toLowerCase() === "apple" ? (
            <div>
              <dt className="text-xs text-muted-foreground">Battery Health</dt>
              <dd className="font-medium">{phone.battery_health || "Not set"}</dd>
            </div>
          ) : null}
          <div>
            <dt className="text-xs text-muted-foreground">Last Updated</dt>
            <dd className="font-medium">{phone.updated_at ? new Date(phone.updated_at).toLocaleString("en-GB") : "Not available"}</dd>
          </div>
        </dl>
      </section>

      <div className="grid gap-4 xl:grid-cols-2">
        {isAdmin ? (
          <section className="rounded-lg border bg-card p-5 shadow-sm">
            <div className="text-sm font-semibold">Sale history</div>
            <div className="mt-3 flex flex-col gap-2">
              {(sales ?? []).map((sale) => (
                <Link key={sale.id} href={`/receipt/${sale.id}`} className="rounded-lg border bg-background p-3 text-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-semibold">{formatMoneyExact(sale.selling_price)}</div>
                      <div className="text-xs text-muted-foreground">{sale.customer_name ?? "Walk-in customer"} / {sale.customer_phone ?? "No phone"}</div>
                    </div>
                    <div className="text-right text-xs text-muted-foreground">
                      <div>{new Date(sale.sold_at).toLocaleDateString("en-GB")}</div>
                      <div>{sale.payment_method}</div>
                      <div>{formatPaymentStatus(sale.payment_status)}</div>
                    </div>
                  </div>
                </Link>
              ))}
              {(sales ?? []).length === 0 ? <EmptyState title="No sale history" description="Sales for this phone will appear here." /> : null}
            </div>
          </section>
        ) : null}

        <section className="rounded-lg border bg-card p-5 shadow-sm">
          <div className="text-sm font-semibold">Dealer history</div>
          <div className="mt-3 flex flex-col gap-2">
            {safeDealerRecords.map((record) => (
              <div key={record.id} className="rounded-lg border bg-background p-3 text-sm">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-semibold">{record.dealers?.name ?? "Unknown dealer"}</div>
                    <div className="text-xs text-muted-foreground">Agreed {formatMoney(record.agreed_price)} / Money received {formatMoney(record.amount_paid)}</div>
                  </div>
                  <StatusBadge status={record.status} />
                </div>
              </div>
            ))}
            {safeDealerRecords.length === 0 ? <EmptyState title="No dealer history" description="Dealer transactions for this phone will appear here." /> : null}
          </div>
        </section>
      </div>

      <section className="rounded-lg border bg-card p-5 shadow-sm">
        <div className="text-sm font-semibold">Related activity</div>
        <div className="mt-3 flex flex-col gap-2">
          {(activity ?? []).map((item) => (
            <div key={item.id} className="rounded-lg border bg-background p-3 text-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="font-semibold">{formatActivityAction(item.action)}</div>
                  <div className="text-xs text-muted-foreground">{item.description}</div>
                </div>
                <div className="text-xs text-muted-foreground">{new Date(item.created_at).toLocaleDateString("en-GB")}</div>
              </div>
            </div>
          ))}
          {(activity ?? []).length === 0 ? <EmptyState title="No linked activity" description="Future actions on this phone will appear here." /> : null}
        </div>
      </section>
    </div>
  );
}
