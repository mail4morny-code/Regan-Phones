import Link from "next/link";

import { PrintButton } from "@/components/sales/PrintButton";
import { PageHeader } from "@/components/ui/PageHeader";
import { requireProfileRole } from "@/lib/auth/requireProfile";
import { formatMoneyExact } from "@/lib/format/currency";
import { formatPaymentStatus } from "@/lib/format/display";
import { isMissingColumnError, logSupabaseWarning } from "@/lib/supabase/errors";
import { createSupabaseOperationalServerClient } from "@/lib/supabase/operationalServer";

type SaleReceipt = {
  id: string;
  customer_name: string | null;
  customer_phone: string | null;
  selling_price: number;
  payment_method: string;
  payment_status: "Pending Admin Confirmation" | "Received";
  sold_at: string;
  phones: { imei: string; brand: string; model: string; storage: string | null; color: string | null } | null;
};
type LegacySaleReceipt = Omit<SaleReceipt, "payment_method">;

export default async function ReceiptPage({
  params,
}: {
  params: Promise<{ saleId: string }> | { saleId: string };
}) {
  const profile = await requireProfileRole();
  const { saleId } = await params;
  const supabase = await createSupabaseOperationalServerClient(profile);

  const receiptResult = await supabase
    .from("sales")
    .select("id, customer_name, customer_phone, selling_price, payment_method, payment_status, sold_at, phones:phone_id(imei, brand, model, storage, color)")
    .eq("id", saleId)
    .limit(1)
    .maybeSingle();

  let saleData: unknown = receiptResult.data;
  if (receiptResult.error && isMissingColumnError(receiptResult.error)) {
    logSupabaseWarning("[Receipt] payment_method column missing; using Cash fallback. Apply migration 0004.", receiptResult.error);
    const legacy = await supabase
      .from("sales")
      .select("id, customer_name, customer_phone, selling_price, sold_at, phones:phone_id(imei, brand, model, storage, color)")
      .eq("id", saleId)
      .limit(1)
      .maybeSingle();
    saleData = legacy.data ? { ...(legacy.data as unknown as LegacySaleReceipt), payment_method: "Cash", payment_status: "Received" } : null;
  } else if (receiptResult.error) {
    logSupabaseWarning("[Receipt] Lookup failed", receiptResult.error);
  }
  const sale = saleData as unknown as SaleReceipt | null;

  if (!sale) {
    return (
      <div className="flex flex-col gap-4">
        <PageHeader title="Receipt not found" subtitle="This receipt could not be loaded." />
        <Link href="/inventory" className="inline-flex h-11 w-fit items-center rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground">
          Back to My Phones
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Receipt"
        subtitle="Printable customer sale receipt."
        actions={<PrintButton />}
      />

      <section className="mx-auto w-full max-w-2xl rounded-lg border bg-card p-6 shadow-sm print:border-0 print:shadow-none">
        <div className="border-b pb-4">
          <div className="text-2xl font-bold tracking-tight">Regan Phones</div>
          <div className="mt-1 text-sm text-muted-foreground">Sales Receipt</div>
        </div>

        <div className="mt-5 grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <div className="text-xs text-muted-foreground">Receipt ID</div>
            <div className="font-mono text-xs">{sale.id}</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Date</div>
            <div className="font-semibold">{new Date(sale.sold_at).toLocaleString("en-GB")}</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Customer</div>
            <div className="font-semibold">{sale.customer_name ?? "Walk-in customer"}</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Customer phone</div>
            <div className="font-semibold">{sale.customer_phone ?? "Not provided"}</div>
          </div>
        </div>

        <div className="mt-6 rounded-lg bg-background p-4">
          <div className="text-sm font-semibold">{sale.phones ? `${sale.phones.brand} ${sale.phones.model}` : "Phone"}</div>
          <div className="mt-1 text-xs text-muted-foreground">
            IMEI {sale.phones?.imei ?? "Not available"}
            {sale.phones?.storage ? ` / ${sale.phones.storage}` : ""}
            {sale.phones?.color ? ` / ${sale.phones.color}` : ""}
          </div>
        </div>

        <div className="mt-6 flex items-center justify-between border-t pt-4">
          <div>
            <div className="text-xs text-muted-foreground">Payment method</div>
            <div className="font-semibold">{sale.payment_method}</div>
            <div className="mt-1 text-xs text-muted-foreground">
              {formatPaymentStatus(sale.payment_status)}
            </div>
          </div>
          <div className="text-right">
            <div className="text-xs text-muted-foreground">Total paid</div>
            <div className="text-2xl font-bold">{formatMoneyExact(sale.selling_price)}</div>
          </div>
        </div>
      </section>
    </div>
  );
}
