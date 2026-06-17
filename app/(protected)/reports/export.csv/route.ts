import { NextResponse } from "next/server";

import { requireProfileRole } from "@/lib/auth/requireProfile";
import { formatPaymentStatus } from "@/lib/format/display";
import { createSupabaseAppServerClient } from "@/lib/supabase/appServer";
import { isMissingColumnError } from "@/lib/supabase/errors";

function csvEscape(value: unknown) {
  const text = String(value ?? "");
  return `"${text.replaceAll('"', '""')}"`;
}

export async function GET() {
  await requireProfileRole(["admin"]);
  const supabase = await createSupabaseAppServerClient();
  const result = await supabase
    .from("sales")
    .select("id, selling_price, profit, payment_method, payment_status, confirmed_by, confirmed_at, sold_at, customer_name, customer_phone")
    .order("sold_at", { ascending: false });
  let data = result.data;
  if (result.error && isMissingColumnError(result.error)) {
    const legacy = await supabase
      .from("sales")
      .select("id, selling_price, profit, sold_at, customer_name, customer_phone")
      .order("sold_at", { ascending: false });
    data = (legacy.data ?? []).map((sale) => ({ ...sale, payment_method: "Cash", payment_status: "Received", confirmed_by: "", confirmed_at: sale.sold_at }));
  }

  const rows = [
    ["Sale Reference", "Date Sold", "Customer Name", "Customer Phone", "Selling Price", "Profit", "Payment Method", "Payment Status", "Confirmed By", "Date Confirmed"],
    ...(data ?? []).map((sale) => [
      sale.id,
      sale.sold_at,
      sale.customer_name ?? "",
      sale.customer_phone ?? "",
      sale.selling_price,
      sale.profit,
      sale.payment_method,
      formatPaymentStatus(sale.payment_status),
      sale.confirmed_by,
      sale.confirmed_at,
    ]),
  ];

  const csv = rows.map((row) => row.map(csvEscape).join(",")).join("\n");

  return new NextResponse(csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": "attachment; filename=regan-phones-sales.csv",
    },
  });
}
