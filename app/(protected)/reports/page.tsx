import Link from "next/link";

import { PageHeader } from "@/components/ui/PageHeader";
import { StatCard } from "@/components/ui/StatCard";
import { requireProfileRole } from "@/lib/auth/requireProfile";
import { formatMoney } from "@/lib/format/currency";
import { formatPhoneStatus } from "@/lib/format/display";
import { isOverdue24Hours } from "@/lib/format/time";
import { createSupabaseAppServerClient } from "@/lib/supabase/appServer";
import { isMissingColumnError, logSupabaseWarning } from "@/lib/supabase/errors";

export default async function ReportsPage() {
  await requireProfileRole(["admin"]);

  const supabase = await createSupabaseAppServerClient();
  const today = new Date();
  const startOfDay = new Date(today);
  startOfDay.setHours(0, 0, 0, 0);
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);

  const [{ data: todaySales }, { data: monthSales }, salesResult, { data: stock }, dealerRecordsResult, { data: workers }] = await Promise.all([
    supabase.from("sales").select("selling_price, profit, sold_at, payment_status").gte("sold_at", startOfDay.toISOString()).order("sold_at", { ascending: false }),
    supabase.from("sales").select("selling_price, profit, sold_at, payment_status").gte("sold_at", monthStart.toISOString()).order("sold_at", { ascending: false }),
    supabase.from("sales").select("selling_price, profit, sold_by, payment_status"),
    supabase.from("phones").select("status, cost_price, selling_price, created_by"),
    supabase.from("dealer_records").select("status, agreed_price, amount_paid, date_given"),
    supabase.from("profiles").select("id, full_name, email, role").eq("role", "worker"),
  ]);
  let allSales = salesResult.data;
  if (salesResult.error && isMissingColumnError(salesResult.error)) {
    logSupabaseWarning("[Reports] payment_status column missing; treating legacy sales as received. Apply migration 0008.", salesResult.error);
    const legacy = await supabase.from("sales").select("selling_price, profit, sold_by");
    allSales = (legacy.data ?? []).map((sale) => ({ ...sale, payment_status: "Received" }));
  } else if (salesResult.error) {
    logSupabaseWarning("[Reports] Sales query failed", salesResult.error);
  }
  let dealerRecords = dealerRecordsResult.data;
  if (dealerRecordsResult.error && isMissingColumnError(dealerRecordsResult.error)) {
    logSupabaseWarning("[Reports] amount_paid column missing; using legacy dealer balance fallback. Apply migration 0004.", dealerRecordsResult.error);
    const legacy = await supabase.from("dealer_records").select("status, agreed_price, date_given");
    dealerRecords = (legacy.data ?? []).map((record) => ({ ...record, amount_paid: record.status === "Sold" ? record.agreed_price : 0 }));
  } else if (dealerRecordsResult.error) {
    logSupabaseWarning("[Reports] Dealer records query failed", dealerRecordsResult.error);
  }

  const confirmedTodaySales = (todaySales ?? []).filter((s) => s.payment_status === "Received");
  const confirmedMonthSales = (monthSales ?? []).filter((s) => s.payment_status === "Received");
  const confirmedSales = (allSales ?? []).filter((s) => s.payment_status === "Received");
  const pendingSales = (allSales ?? []).filter((s) => s.payment_status === "Pending Admin Confirmation");
  const dailyTotal = confirmedTodaySales.reduce((a, s) => a + Number(s.selling_price ?? 0), 0);
  const dailyProfit = confirmedTodaySales.reduce((a, s) => a + Number(s.profit ?? 0), 0);
  const monthlyTotal = confirmedMonthSales.reduce((a, s) => a + Number(s.selling_price ?? 0), 0);
  const monthlyProfit = confirmedMonthSales.reduce((a, s) => a + Number(s.profit ?? 0), 0);
  const totalSales = confirmedSales.reduce((a, s) => a + Number(s.selling_price ?? 0), 0);
  const totalProfit = confirmedSales.reduce((a, s) => a + Number(s.profit ?? 0), 0);
  const pendingAmount = pendingSales.reduce((a, s) => a + Number(s.selling_price ?? 0), 0);

  const inStock = (stock ?? []).filter((p) => p.status === "Available").length;
  const sold = (stock ?? []).filter((p) => p.status === "Sold").length;
  const withDealers = (stock ?? []).filter((p) => p.status === "With Dealer").length;
  const returned = (stock ?? []).filter((p) => p.status === "Returned").length;
  const archived = (stock ?? []).filter((p) => p.status === "Archived").length;
  const stockValue = (stock ?? [])
    .filter((p) => p.status === "Available" || p.status === "With Dealer")
    .reduce((a, p) => a + Number(p.cost_price ?? 0), 0);

  const dealerBalance = (dealerRecords ?? []).reduce((sum, r) => sum + Math.max(Number(r.agreed_price ?? 0) - Number(r.amount_paid ?? 0), 0), 0);
  const dealerValue = (dealerRecords ?? []).filter((r) => r.status === "With Dealer").reduce((sum, r) => sum + Number(r.agreed_price ?? 0), 0);
  const overdueDealerPhones = (dealerRecords ?? []).filter((r) => r.status === "With Dealer" && isOverdue24Hours(r.date_given)).length;

  const workerPerformance = (workers ?? []).map((worker) => {
    const workerSales = (allSales ?? []).filter((sale) => sale.sold_by === worker.id);
    const workerConfirmedSales = workerSales.filter((sale) => sale.payment_status === "Received");
    const workerPhones = (stock ?? []).filter((phone) => phone.created_by === worker.id);
    return {
      id: worker.id,
      name: worker.full_name ?? worker.email ?? worker.id,
      sales: workerSales.length,
      salesValue: workerConfirmedSales.reduce((sum, sale) => sum + Number(sale.selling_price ?? 0), 0),
      pendingSales: workerSales.filter((sale) => sale.payment_status === "Pending Admin Confirmation").length,
      addedPhones: workerPhones.length,
    };
  });

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Reports"
        subtitle="Owner sales, profit, stock value, amount owed by dealers, and worker performance."
        actions={<Link href="/reports/export.csv" className="inline-flex h-11 items-center justify-center rounded-lg border bg-card px-4 text-sm font-semibold">Export CSV</Link>}
      />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard title="Today sales" value={formatMoney(dailyTotal)} detail={`Profit ${formatMoney(dailyProfit)}`} />
        <StatCard title="This month" value={formatMoney(monthlyTotal)} detail={`Profit ${formatMoney(monthlyProfit)}`} />
        <StatCard title="Confirmed sales" value={formatMoney(totalSales)} detail={`Profit ${formatMoney(totalProfit)}`} />
        <StatCard title="Waiting for confirmation" value={formatMoney(pendingAmount)} detail={`${pendingSales.length} sale${pendingSales.length === 1 ? "" : "s"} waiting`} />
        <StatCard title="Stock cost value" value={formatMoney(stockValue)} detail="Available phones and phones with dealers" />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <section className="rounded-lg border bg-card p-5 shadow-sm">
          <div className="text-sm font-semibold">Phone status</div>
          <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-3">
            <StatCard title={formatPhoneStatus("Available")} value={String(inStock)} />
            <StatCard title={formatPhoneStatus("Sold")} value={String(sold)} />
            <StatCard title="With Dealers" value={String(withDealers)} />
            <StatCard title={formatPhoneStatus("Returned")} value={String(returned)} />
            <StatCard title={formatPhoneStatus("Archived")} value={String(archived)} />
          </div>
        </section>

        <section className="rounded-lg border bg-card p-5 shadow-sm">
          <div className="text-sm font-semibold">Dealer money</div>
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <StatCard title="Phones with dealers" value={String(withDealers)} />
            <StatCard title="Overdue dealer phones" value={String(overdueDealerPhones)} />
            <StatCard title="Dealer phone value" value={formatMoney(dealerValue)} />
            <StatCard title="Amount owed" value={formatMoney(dealerBalance)} />
          </div>
        </section>
      </div>

      <section className="rounded-lg border bg-card p-5 shadow-sm">
        <div className="text-sm font-semibold">Worker performance</div>
        <div className="mt-3 overflow-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-muted-foreground">
              <tr>
                <th className="py-2 pr-4">Worker</th>
                <th className="py-2 pr-4">Phones added</th>
                <th className="py-2 pr-4">Sales</th>
                <th className="py-2 pr-4">Waiting</th>
                <th className="py-2">Sales value</th>
              </tr>
            </thead>
            <tbody>
              {workerPerformance.map((worker) => (
                <tr key={worker.id} className="border-t">
                  <td className="py-3 pr-4 font-semibold">{worker.name}</td>
                  <td className="py-3 pr-4">{worker.addedPhones}</td>
                  <td className="py-3 pr-4">{worker.sales}</td>
                  <td className="py-3 pr-4">{worker.pendingSales}</td>
                  <td className="py-3">{formatMoney(worker.salesValue)}</td>
                </tr>
              ))}
              {workerPerformance.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-6 text-muted-foreground">No worker activity yet.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
