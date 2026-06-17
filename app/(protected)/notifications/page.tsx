import Link from "next/link";

import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatCard } from "@/components/ui/StatCard";
import { requireProfileRole } from "@/lib/auth/requireProfile";
import { formatMoney } from "@/lib/format/currency";
import { formatActivityAction } from "@/lib/format/display";
import { timeSince } from "@/lib/format/time";
import { getNotifications, type DealerAlertPriority } from "@/lib/notifications/getNotifications";
import { confirmSalePaymentAction } from "@/lib/sales/confirmSalePaymentAction";
import { createSupabaseOperationalServerClient } from "@/lib/supabase/operationalServer";
import { logSupabaseWarning } from "@/lib/supabase/errors";

type SearchParams =
  | Promise<Record<string, string | string[] | undefined>>
  | Record<string, string | string[] | undefined>;

type ActivityLogItem = {
  id: string;
  user_id: string;
  action: string;
  description: string | null;
  created_at: string;
};

type ActivityUser = {
  id: string;
  email: string | null;
  full_name: string | null;
};

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function priorityBadge(priority: DealerAlertPriority) {
  if (priority === "critical") {
    return <span className="w-fit rounded-full bg-red-100 px-2 py-1 text-xs font-semibold text-red-700">Critical (72h+)</span>;
  }
  if (priority === "urgent") {
    return <span className="w-fit rounded-full bg-orange-100 px-2 py-1 text-xs font-semibold text-orange-700">Urgent (48h+)</span>;
  }
  return <span className="w-fit rounded-full bg-amber-100 px-2 py-1 text-xs font-semibold text-amber-800">Warning (24h+)</span>;
}

function whatsappLink(phoneNumber: string | undefined) {
  const digits = (phoneNumber ?? "").replace(/\D/g, "");
  if (!digits) return null;
  return `https://wa.me/${digits}`;
}

function includesQuery(values: Array<string | number | null | undefined>, query: string) {
  if (!query) return true;
  const needle = query.toLowerCase();
  return values.some((value) => String(value ?? "").toLowerCase().includes(needle));
}

function matchesDate(value: string | null | undefined, date: string) {
  if (!date) return true;
  if (!value) return false;
  return new Date(value).toISOString().slice(0, 10) === date;
}

export default async function NotificationsPage({
  searchParams,
}: {
  searchParams?: SearchParams;
}) {
  const profile = await requireProfileRole();
  const supabase = await createSupabaseOperationalServerClient(profile);
  const isAdmin = profile.role === "admin";
  const resolved = (await searchParams) ?? {};
  const q = (firstParam(resolved.q) ?? "").trim();
  const actionFilter = firstParam(resolved.action) ?? "";
  const dateFilter = firstParam(resolved.date) ?? "";
  const userFilter = firstParam(resolved.user) ?? "";

  const notifications = await getNotifications(supabase, { role: profile.role, userId: profile.id });

  let activityQuery = supabase
    .from("activity_log")
    .select("id, user_id, action, description, created_at")
    .order("created_at", { ascending: false })
    .limit(300);

  if (actionFilter) activityQuery = activityQuery.eq("action", actionFilter);
  if (isAdmin && userFilter) activityQuery = activityQuery.eq("user_id", userFilter);
  if (!isAdmin) activityQuery = activityQuery.eq("user_id", profile.id);
  if (dateFilter) {
    const start = new Date(dateFilter);
    const end = new Date(dateFilter);
    end.setDate(end.getDate() + 1);
    activityQuery = activityQuery.gte("created_at", start.toISOString()).lt("created_at", end.toISOString());
  }

  let actionsQuery = supabase.from("activity_log").select("action").limit(500);
  if (!isAdmin) actionsQuery = actionsQuery.eq("user_id", profile.id);

  const [{ data: activityData, error: activityError }, usersResult, { data: actionRows }] = await Promise.all([
    activityQuery,
    isAdmin
      ? supabase.from("profiles").select("id, email, full_name").order("email", { ascending: true })
      : Promise.resolve({ data: [{ id: profile.id, email: profile.email, full_name: profile.full_name }] as ActivityUser[], error: null }),
    actionsQuery,
  ]);

  if (activityError) logSupabaseWarning("[Alerts] Activity could not be loaded", activityError);

  const users = (usersResult.data ?? []) as ActivityUser[];
  const userMap = new Map(users.map((user) => [user.id, user.full_name ?? user.email ?? user.id]));
  const uniqueActions = Array.from(new Set((actionRows ?? []).map((row) => row.action))).sort((a, b) =>
    formatActivityAction(a).localeCompare(formatActivityAction(b))
  );

  const dealerAlerts = notifications.dealerAlerts.filter((alert) =>
    matchesDate(alert.date_given, dateFilter) &&
    includesQuery([
      alert.dealers?.name,
      alert.dealers?.phone_number,
      alert.phones?.imei,
      alert.phones?.brand,
      alert.phones?.model,
      alert.agreed_price,
      alert.priority,
    ], q)
  );
  const pendingSaleConfirmations = notifications.pendingSaleConfirmations.filter((sale) =>
    matchesDate(sale.sold_at, dateFilter) &&
    includesQuery([
      sale.customer_name,
      sale.selling_price,
      sale.phones?.imei,
      sale.phones?.brand,
      sale.phones?.model,
      sale.profiles?.full_name,
      sale.profiles?.email,
    ], q)
  );
  const recentlySold = notifications.recentlySold.filter((sale) =>
    matchesDate(sale.sold_at, dateFilter) &&
    includesQuery([
      sale.customer_name,
      sale.selling_price,
      sale.phones?.imei,
      sale.phones?.brand,
      sale.phones?.model,
    ], q)
  );
  const activity = ((activityData ?? []) as ActivityLogItem[]).filter((item) =>
    includesQuery([item.action, formatActivityAction(item.action), item.description, userMap.get(item.user_id)], q)
  );
  const systemAlerts = notifications.systemAlerts.filter((alert) => includesQuery([alert], q));

  const warningCount = dealerAlerts.filter((alert) => alert.priority === "warning").length;
  const urgentCount = dealerAlerts.filter((alert) => alert.priority === "urgent").length;
  const criticalCount = dealerAlerts.filter((alert) => alert.priority === "critical").length;
  const totalVisible = dealerAlerts.length + pendingSaleConfirmations.length + recentlySold.length + activity.length + systemAlerts.length;
  const hasFilters = Boolean(q || actionFilter || dateFilter || userFilter);

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Alerts"
        subtitle={isAdmin ? "Dealer follow-ups, money waiting for confirmation, activity, and system status in one place." : "Dealer follow-ups, your activity, and system status in one place."}
      />

      <form action="/notifications" className="grid gap-3 rounded-2xl border border-black/5 bg-card p-4 shadow-sm md:grid-cols-5">
        <label className="flex flex-col gap-1 md:col-span-2">
          <span className="text-xs font-medium text-muted-foreground">Search alerts and activity</span>
          <input
            name="q"
            defaultValue={q}
            placeholder="IMEI, model, dealer, worker, action"
            className="h-11 rounded-lg border bg-background px-3"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-muted-foreground">Date</span>
          <input name="date" type="date" defaultValue={dateFilter} className="h-11 rounded-lg border bg-background px-3" />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-muted-foreground">Activity action</span>
          <select name="action" defaultValue={actionFilter} className="h-11 rounded-lg border bg-background px-3">
            <option value="">All actions</option>
            {uniqueActions.map((action) => (
              <option key={action} value={action}>{formatActivityAction(action)}</option>
            ))}
          </select>
        </label>
        {isAdmin ? (
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-muted-foreground">User</span>
            <select name="user" defaultValue={userFilter} className="h-11 rounded-lg border bg-background px-3">
              <option value="">All users</option>
              {users.map((user) => (
                <option key={user.id} value={user.id}>{user.full_name ?? user.email ?? user.id}</option>
              ))}
            </select>
          </label>
        ) : null}
        <div className={isAdmin ? "flex items-end gap-2 md:col-span-5" : "flex items-end gap-2 md:col-span-4"}>
          <button className="h-11 flex-1 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground sm:flex-none">
            Filter
          </button>
          {hasFilters ? (
            <Link href="/notifications" className="inline-flex h-11 flex-1 items-center justify-center rounded-lg border bg-card px-4 text-sm font-semibold sm:flex-none">
              Clear
            </Link>
          ) : null}
        </div>
      </form>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard title={hasFilters ? "Matching items" : "Total items"} value={String(totalVisible)} />
        <StatCard title="Warning" value={String(warningCount)} detail="24h+ with dealer" />
        <StatCard title="Urgent" value={String(urgentCount)} detail="48h+ with dealer" />
        <StatCard title="Critical" value={String(criticalCount)} detail="72h+ with dealer" />
      </div>

      <section className="rounded-lg border bg-card p-4 shadow-sm md:p-5">
        {isAdmin && pendingSaleConfirmations.length > 0 ? (
          <div className="mb-4 rounded-lg border border-blue-200 bg-blue-50 p-4">
            <div className="text-sm font-semibold">Money Waiting for Confirmation</div>
            <div className="mt-3 grid gap-3">
              {pendingSaleConfirmations.map((sale) => {
                const workerName = sale.profiles?.full_name ?? sale.profiles?.email ?? "Worker";
                const phoneLabel = sale.phones ? `${sale.phones.brand} ${sale.phones.model} / IMEI ${sale.phones.imei}` : "phone";
                return (
                  <div key={sale.id} className="rounded-lg border bg-card p-3 text-sm">
                    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                      <div>
                        <div className="font-semibold">{workerName} sold {phoneLabel}</div>
                        <div className="mt-1 text-xs text-muted-foreground">Owner needs to confirm payment: {formatMoney(sale.selling_price)} / {timeSince(sale.sold_at)}</div>
                      </div>
                      <form action={confirmSalePaymentAction}>
                        <input type="hidden" name="sale_id" value={sale.id} />
                        <button className="h-10 w-full rounded-lg bg-primary px-3 text-xs font-semibold text-primary-foreground md:w-auto">
                          Money Received
                        </button>
                      </form>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : null}

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="text-sm font-semibold">Dealer phone alerts</div>
            <div className="mt-1 text-xs text-muted-foreground">Critical alerts appear first.</div>
          </div>
          <Link href="/dealer-phones" className="text-sm font-semibold text-primary">Open dealer phones</Link>
        </div>

        <div className="mt-3 grid gap-3 xl:grid-cols-2">
          {dealerAlerts.map((alert) => {
            const waLink = whatsappLink(alert.dealers?.phone_number);
            return (
              <article
                key={alert.id}
                className={
                  alert.priority === "critical"
                    ? "rounded-lg border border-red-200 bg-red-50 p-4"
                    : alert.priority === "urgent"
                      ? "rounded-lg border border-orange-200 bg-orange-50 p-4"
                      : "rounded-lg border border-amber-200 bg-amber-50 p-4"
                }
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <div className="text-sm font-semibold">{alert.phones ? `${alert.phones.brand} ${alert.phones.model}` : "Dealer phone"}</div>
                    <div className="mt-1 text-xs text-muted-foreground">IMEI {alert.phones?.imei ?? "Not available"}</div>
                    <div className="mt-1 text-xs text-muted-foreground">{alert.dealers?.name ?? "Unknown dealer"} / {alert.dealers?.phone_number ?? ""}</div>
                    <div className="mt-1 text-xs text-muted-foreground">With dealer for {alert.hours}h / {timeSince(alert.date_given)}</div>
                  </div>
                  {priorityBadge(alert.priority)}
                </div>
                <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <span className="text-sm font-semibold">{formatMoney(alert.agreed_price)}</span>
                  {waLink ? (
                    <a href={waLink} target="_blank" rel="noreferrer" className="inline-flex h-9 items-center justify-center rounded-lg border bg-card px-3 text-xs font-semibold">
                      WhatsApp
                    </a>
                  ) : null}
                </div>
              </article>
            );
          })}
          {dealerAlerts.length === 0 ? (
            <div className="xl:col-span-2">
              <EmptyState title="No dealer alerts" description={hasFilters ? "No dealer alerts match these filters." : "No phones have crossed the 24-hour dealer follow-up window."} />
            </div>
          ) : null}
        </div>
      </section>

      {isAdmin ? (
        <section className="rounded-lg border bg-card p-4 shadow-sm md:p-5">
          <div className="text-sm font-semibold">Recently sold phones</div>
          <div className="mt-3 flex flex-col gap-2">
            {recentlySold.map((sale) => (
              <Link key={sale.id} href={`/receipt/${sale.id}`} className="rounded-lg border bg-background p-3 text-sm">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <div className="font-semibold">{sale.phones ? `${sale.phones.brand} ${sale.phones.model}` : "Sold phone"}</div>
                    <div className="mt-1 text-xs text-muted-foreground">{sale.customer_name ?? "Walk-in customer"} / {timeSince(sale.sold_at)}</div>
                  </div>
                  <div className="text-sm font-semibold">{formatMoney(sale.selling_price)}</div>
                </div>
              </Link>
            ))}
            {recentlySold.length === 0 ? <EmptyState title="No recent sales" description={hasFilters ? "No sales match these filters." : "New sales will appear here."} /> : null}
          </div>
        </section>
      ) : null}

      <section className="rounded-lg border bg-card p-4 shadow-sm md:p-5">
        <div className="text-sm font-semibold">{isAdmin ? "Activity" : "Your activity"}</div>
        <div className="mt-3 flex flex-col gap-3">
          {activity.map((item) => (
            <div key={item.id} className="rounded-lg border bg-background p-4">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <div className="text-sm font-semibold">{formatActivityAction(item.action)}</div>
                  {item.description ? <div className="mt-1 text-sm text-muted-foreground">{item.description}</div> : null}
                  <div className="mt-1 text-xs text-muted-foreground">By {userMap.get(item.user_id) ?? item.user_id}</div>
                </div>
                <div className="shrink-0 text-xs text-muted-foreground">{new Date(item.created_at).toLocaleString("en-GB")}</div>
              </div>
            </div>
          ))}
          {activity.length === 0 ? (
            <EmptyState title="No activity found" description={hasFilters ? "No activity matches these filters." : "Phone, sale, worker, and dealer actions will appear here."} />
          ) : null}
        </div>
      </section>

      <section className="rounded-lg border bg-card p-4 shadow-sm md:p-5">
        <div className="text-sm font-semibold">System alerts</div>
        <div className="mt-3 grid gap-2">
          {systemAlerts.map((alert) => (
            <div key={alert} className="rounded-lg border bg-background p-3 text-sm text-muted-foreground">
              {alert}
            </div>
          ))}
          {systemAlerts.length === 0 ? <EmptyState title="No system alerts found" description="System alerts do not match these filters." /> : null}
        </div>
      </section>
    </div>
  );
}
