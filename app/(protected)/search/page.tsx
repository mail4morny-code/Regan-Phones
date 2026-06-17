import Link from "next/link";

import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { requireProfileRole } from "@/lib/auth/requireProfile";
import { formatMoney } from "@/lib/format/currency";
import { createSupabaseAppServerClient } from "@/lib/supabase/appServer";

type PhoneResult = { id: string; imei: string; brand: string; model: string; status: string };
type DealerResult = { id: string; name: string; phone_number: string };
type SaleResult = {
  id: string;
  customer_name: string | null;
  customer_phone: string | null;
  selling_price: number;
  sold_at: string;
};

export default async function SearchPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>> | Record<string, string | string[] | undefined>;
}) {
  await requireProfileRole(["admin"]);
  const resolved = (await searchParams) ?? {};
  const qRaw = resolved.q;
  const q = (Array.isArray(qRaw) ? qRaw[0] : qRaw)?.trim() ?? "";
  const supabase = await createSupabaseAppServerClient();

  const needle = q.replaceAll(",", "");
  const hasQuery = needle.length > 0;

  const [phonesResult, dealersResult, salesResult] = hasQuery
    ? await Promise.all([
        supabase
          .from("phones")
          .select("id, imei, brand, model, status")
          .or(`imei.ilike.%${needle}%,brand.ilike.%${needle}%,model.ilike.%${needle}%`)
          .limit(20),
        supabase
          .from("dealers")
          .select("id, name, phone_number")
          .or(`name.ilike.%${needle}%,phone_number.ilike.%${needle}%`)
          .limit(20),
        supabase
          .from("sales")
          .select("id, customer_name, customer_phone, selling_price, sold_at, phones:phone_id(imei, brand, model)")
          .or(`customer_name.ilike.%${needle}%,customer_phone.ilike.%${needle}%`)
          .limit(20),
      ])
    : [
        { data: [] },
        { data: [] },
        { data: [] },
      ];

  const phones = (phonesResult.data ?? []) as PhoneResult[];
  const dealers = (dealersResult.data ?? []) as DealerResult[];
  const sales = (salesResult.data ?? []) as SaleResult[];
  const noResults = hasQuery && phones.length === 0 && dealers.length === 0 && sales.length === 0;

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title="Search" subtitle="Search by IMEI, brand, model, dealer name, or customer phone." />

      <form action="/search" className="rounded-lg border bg-card p-4 shadow-sm">
        <div className="flex flex-col gap-2 sm:flex-row">
          <input name="q" defaultValue={q} className="h-11 min-w-0 flex-1 rounded-lg border bg-background px-3" placeholder="IMEI, dealer, customer phone..." />
          <button className="h-11 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground">Search</button>
        </div>
      </form>

      {!hasQuery ? <EmptyState title="Start searching" description="Enter an IMEI, phone model, dealer name, or customer phone number." /> : null}
      {noResults ? <EmptyState title="No results found" description="Try a different IMEI, name, model, or phone number." /> : null}

      {phones.length > 0 ? (
        <section className="rounded-lg border bg-card p-4 shadow-sm">
          <div className="text-sm font-semibold">Phones</div>
          <div className="mt-3 grid gap-2 xl:grid-cols-2">
            {phones.map((phone) => (
              <Link key={phone.id} href={`/phone-details/${encodeURIComponent(phone.imei)}`} className="rounded-lg border bg-background p-3 text-sm">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-semibold">{phone.brand} {phone.model}</div>
                    <div className="text-xs text-muted-foreground">IMEI {phone.imei}</div>
                  </div>
                  <StatusBadge status={phone.status} />
                </div>
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      {dealers.length > 0 ? (
        <section className="rounded-lg border bg-card p-4 shadow-sm">
          <div className="text-sm font-semibold">Dealers</div>
          <div className="mt-3 grid gap-2 xl:grid-cols-2">
            {dealers.map((dealer) => (
              <Link key={dealer.id} href={`/dealers/${dealer.id}`} className="rounded-lg border bg-background p-3 text-sm">
                <div className="font-semibold">{dealer.name}</div>
                <div className="text-xs text-muted-foreground">{dealer.phone_number}</div>
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      {sales.length > 0 ? (
        <section className="rounded-lg border bg-card p-4 shadow-sm">
          <div className="text-sm font-semibold">Customer sales</div>
          <div className="mt-3 grid gap-2 xl:grid-cols-2">
            {sales.map((sale) => (
              <Link key={sale.id} href={`/receipt/${sale.id}`} className="rounded-lg border bg-background p-3 text-sm">
                <div className="font-semibold">{sale.customer_name ?? "Customer"} / {sale.customer_phone ?? "No phone"}</div>
                <div className="text-xs text-muted-foreground">{formatMoney(sale.selling_price)} / {new Date(sale.sold_at).toLocaleDateString("en-GB")}</div>
              </Link>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
