import Link from "next/link";

import { PrintButton } from "@/components/sales/PrintButton";
import { PageHeader } from "@/components/ui/PageHeader";
import { requireProfileRole } from "@/lib/auth/requireProfile";
import { formatMoney } from "@/lib/format/currency";
import { logSupabaseWarning } from "@/lib/supabase/errors";
import { createSupabaseOperationalServerClient } from "@/lib/supabase/operationalServer";

type DealerBatchRecord = {
  id: string;
  agreed_price: number;
  date_given: string;
  dealers: { name: string; phone_number: string } | null;
  phones: { imei: string; brand: string; model: string; storage: string | null; color: string | null } | null;
};

export default async function DealerReceiptPage({
  params,
}: {
  params: Promise<{ batchId: string }> | { batchId: string };
}) {
  const profile = await requireProfileRole();
  const { batchId } = await params;
  const supabase = await createSupabaseOperationalServerClient(profile);

  const { data, error } = await supabase
    .from("dealer_records")
    .select("id, agreed_price, date_given, dealers:dealer_id(name, phone_number), phones:phone_id(imei, brand, model, storage, color)")
    .eq("batch_id", batchId)
    .order("created_at", { ascending: true });

  if (error) logSupabaseWarning("[Dealer Receipt] Batch receipt query failed", error);

  const records = (data ?? []) as DealerBatchRecord[];
  const first = records[0];
  const total = records.reduce((sum, record) => sum + Number(record.agreed_price ?? 0), 0);

  if (!first) {
    return (
      <div className="flex flex-col gap-4">
        <PageHeader title="Dealer receipt not found" subtitle="This dealer receipt could not be loaded." />
        <Link href="/dealer-phones" className="inline-flex h-11 w-fit items-center rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground">
          Back to Dealer Phones
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title="Dealer Receipt" subtitle="Printable dealer consignment receipt." actions={<PrintButton />} />

      <section className="mx-auto w-full max-w-3xl rounded-lg border bg-card p-6 shadow-sm print:border-0 print:shadow-none">
        <div className="border-b pb-4">
          <div className="text-2xl font-bold tracking-tight">Regan Phones</div>
          <div className="mt-1 text-sm text-muted-foreground">Dealer Consignment Receipt</div>
        </div>

        <div className="mt-5 grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <div className="text-xs text-muted-foreground">Dealer</div>
            <div className="font-semibold">{first.dealers?.name ?? "Unknown dealer"}</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Dealer phone</div>
            <div className="font-semibold">{first.dealers?.phone_number ?? "Not provided"}</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Date given</div>
            <div className="font-semibold">{new Date(first.date_given).toLocaleString("en-GB")}</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Receipt reference</div>
            <div className="font-mono text-xs">{batchId}</div>
          </div>
        </div>

        <div className="mt-6 overflow-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-muted-foreground">
              <tr>
                <th className="py-2 pr-4">Phone</th>
                <th className="py-2 pr-4">IMEI</th>
                <th className="py-2 pr-4">Details</th>
                <th className="py-2 text-right">Agreed price</th>
              </tr>
            </thead>
            <tbody>
              {records.map((record) => (
                <tr key={record.id} className="border-t">
                  <td className="py-3 pr-4 font-semibold">{record.phones ? `${record.phones.brand} ${record.phones.model}` : "Phone"}</td>
                  <td className="py-3 pr-4 font-mono text-xs">{record.phones?.imei ?? "Not available"}</td>
                  <td className="py-3 pr-4 text-xs text-muted-foreground">{[record.phones?.storage, record.phones?.color].filter(Boolean).join(" / ") || "Not set"}</td>
                  <td className="py-3 text-right font-semibold">{formatMoney(record.agreed_price)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-6 flex items-center justify-between border-t pt-4">
          <div className="text-sm text-muted-foreground">{records.length} phone{records.length === 1 ? "" : "s"} given to dealer</div>
          <div className="text-right">
            <div className="text-xs text-muted-foreground">Total agreed value</div>
            <div className="text-2xl font-bold">{formatMoney(total)}</div>
          </div>
        </div>
      </section>
    </div>
  );
}
