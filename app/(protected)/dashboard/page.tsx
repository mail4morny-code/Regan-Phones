import Link from "next/link";

import { ActionButtonCard } from "@/components/ui/ActionButtonCard";
import { StatCard } from "@/components/ui/StatCard";
import { requireProfileRole } from "@/lib/auth/requireProfile";
import { formatMoney } from "@/lib/format/currency";
import { formatActivityAction, formatPersonName } from "@/lib/format/display";
import { timeSince } from "@/lib/format/time";
import { getNotifications } from "@/lib/notifications/getNotifications";
import { confirmSalePaymentAction } from "@/lib/sales/confirmSalePaymentAction";
import { createSupabaseOperationalServerClient } from "@/lib/supabase/operationalServer";
import { logSupabaseWarning } from "@/lib/supabase/errors";

export default async function DashboardPage() {
  const profile = await requireProfileRole();

  const supabase = await createSupabaseOperationalServerClient(profile);
  const now = new Date();
  const startOfDay = new Date(now);
  startOfDay.setHours(0, 0, 0, 0);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const isAdmin = profile.role === "admin";

  const [
    { data: phones, error: stockErr },
    { data: recentActivity, error: activityErr },
    { data: phonesAddedToday },
    { data: myActionsToday },
    todaySalesResult,
    monthSalesResult,
  ] = await Promise.all([
    supabase.from("phones").select("status").order("created_at", { ascending: false }),
    isAdmin
      ? supabase.from("activity_log").select("action, description, created_at").order("created_at", { ascending: false }).limit(6)
      : supabase.from("activity_log").select("action, description, created_at").eq("user_id", profile.id).order("created_at", { ascending: false }).limit(6),
    supabase.from("phones").select("id").eq("created_by", profile.id).gte("created_at", startOfDay.toISOString()),
    supabase.from("activity_log").select("id").eq("user_id", profile.id).gte("created_at", startOfDay.toISOString()),
    isAdmin
      ? supabase.from("sales").select("selling_price").eq("payment_status", "Received").gte("sold_at", startOfDay.toISOString())
      : Promise.resolve({ data: [], error: null }),
    isAdmin
      ? supabase.from("sales").select("profit").eq("payment_status", "Received").gte("sold_at", monthStart.toISOString())
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (stockErr) logSupabaseWarning("[Dashboard] Phone totals could not be loaded", stockErr);
  if (activityErr) logSupabaseWarning("[Dashboard] Recent activity could not be loaded", activityErr);
  if (todaySalesResult.error) logSupabaseWarning("[Dashboard] Today sales could not be loaded", todaySalesResult.error);
  if (monthSalesResult.error) logSupabaseWarning("[Dashboard] Month profit could not be loaded", monthSalesResult.error);

  const safePhones = phones ?? [];
  const myPhones = safePhones.filter((phone) => phone.status !== "Sold" && phone.status !== "Archived").length;
  const withDealers = safePhones.filter((phone) => phone.status === "With Dealer").length;
  const salesToday = (todaySalesResult.data ?? []).reduce((sum, sale) => sum + Number(sale.selling_price ?? 0), 0);
  const profitThisMonth = (monthSalesResult.data ?? []).reduce((sum, sale) => sum + Number(sale.profit ?? 0), 0);
  const notifications = await getNotifications(supabase, { role: profile.role, userId: profile.id });
  const urgentFollowUps = notifications.dealerAlerts.slice(0, 3);
  const pendingSaleConfirmations = notifications.pendingSaleConfirmations.slice(0, 3);

  return (
    <div className="flex flex-col gap-6 md:gap-8">
      <section className="pt-1 md:pt-4">
        <div className="text-sm font-medium text-muted-foreground">Dashboard</div>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl md:text-5xl">Welcome back</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base md:mt-4">
          Here is what needs attention today.
        </p>
      </section>

      <section className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <StatCard title="My Phones" value={String(myPhones)} detail="Active stock" />
        <StatCard title="With Dealers" value={String(withDealers)} detail="Currently consigned" />
        {isAdmin ? (
          <>
            <StatCard title="Sales Today" value={formatMoney(salesToday)} detail="Recorded today" />
            <StatCard title="Profit This Month" value={formatMoney(profitThisMonth)} detail="Month to date" />
          </>
        ) : (
          <>
            <StatCard title="Phones Added Today" value={String(phonesAddedToday?.length ?? 0)} detail="Your entries" />
            <StatCard title="My Actions Today" value={String(myActionsToday?.length ?? 0)} detail="Your activity" />
          </>
        )}
      </section>

      <section className="rounded-2xl border border-black/5 bg-card p-4 shadow-sm sm:p-6 md:p-8">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-xl font-semibold tracking-tight sm:text-2xl">Notifications</h2>
            <p className="mt-2 text-sm text-muted-foreground sm:text-base">
              {notifications.alertCount > 0
                ? `${notifications.alertCount} important item${notifications.alertCount === 1 ? "" : "s"} need attention.`
                : "No important dealer follow-ups right now."}
            </p>
          </div>
          <Link href="/notifications" className="inline-flex h-11 w-full items-center justify-center rounded-xl border bg-card px-4 text-sm font-semibold sm:w-fit">
            View all
          </Link>
        </div>

        <div className="mt-6 flex flex-col gap-3">
          {isAdmin && pendingSaleConfirmations.map((sale) => {
            const workerName = formatPersonName(sale.profiles?.full_name, sale.profiles?.email);
            const phoneLabel = sale.phones ? `${sale.phones.brand} ${sale.phones.model} / IMEI ${sale.phones.imei}` : "phone";
            return (
              <div key={sale.id} className="rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <div className="font-semibold">{workerName} sold {phoneLabel}</div>
                    <div className="mt-1 text-sm text-muted-foreground">Owner needs to confirm payment: {formatMoney(sale.selling_price)}</div>
                  </div>
                  <form action={confirmSalePaymentAction}>
                    <input type="hidden" name="sale_id" value={sale.id} />
                    <button className="h-10 w-full rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground sm:w-auto">
                      Money Received
                    </button>
                  </form>
                </div>
              </div>
            );
          })}
          {urgentFollowUps.map((record) => (
            <Link key={record.id} href="/notifications" className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="font-semibold">{record.phones ? `${record.phones.brand} ${record.phones.model}` : "Dealer phone"}</div>
                  <div className="mt-1 text-sm text-muted-foreground">
                    {record.dealers?.name ?? "Unknown dealer"} / {record.hours}h with dealer
                  </div>
                </div>
                <span className="w-fit rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800">
                  Follow up
                </span>
              </div>
            </Link>
          ))}
          {urgentFollowUps.length === 0 && pendingSaleConfirmations.length === 0 ? (
            <div className="rounded-2xl border border-dashed bg-background p-5 text-base text-muted-foreground">
              Everything looks calm. No dealer phone has crossed the follow-up window.
            </div>
          ) : null}
        </div>
      </section>

      <section>
        <h2 className="text-xl font-semibold tracking-tight sm:text-2xl">Quick Actions</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <ActionButtonCard href="/add-phone" title="Add Phone" description="Record a new IMEI" />
          <ActionButtonCard href="/sell-phone" title="Sell Phone" description="Create a sale receipt" />
          <ActionButtonCard href="/give-to-dealer" title="Give To Dealer" description="Move phones to a dealer" />
        </div>
      </section>

      <section className="rounded-2xl border border-black/5 bg-card p-4 shadow-sm sm:p-6 md:p-8">
        <h2 className="text-xl font-semibold tracking-tight sm:text-2xl">Recent Activity</h2>
        <div className="mt-5 divide-y">
          {(recentActivity ?? []).map((activity) => (
            <div key={String(activity.created_at)} className="flex flex-col gap-1 py-4 first:pt-0 last:pb-0 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <div className="text-base font-medium">{formatActivityAction(activity.action)}</div>
                <div className="mt-1 text-sm text-muted-foreground">{activity.description ?? "No description"}</div>
              </div>
              <div className="shrink-0 text-sm text-muted-foreground">{timeSince(activity.created_at)}</div>
            </div>
          ))}
          {(!recentActivity || recentActivity.length === 0) ? (
            <div className="rounded-2xl border border-dashed bg-background p-5 text-base text-muted-foreground">
              No activity yet.
            </div>
          ) : null}
        </div>
      </section>
    </div>
  );
}
