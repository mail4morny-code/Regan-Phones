import Link from "next/link";

import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { requireProfileRole } from "@/lib/auth/requireProfile";
import { formatMoney } from "@/lib/format/currency";
import { formatPhoneStatus } from "@/lib/format/display";
import { isMissingColumnError, logSupabaseWarning } from "@/lib/supabase/errors";
import { createSupabaseOperationalServerClient } from "@/lib/supabase/operationalServer";

const STATUS_FILTERS: Array<{ label: string; value: string | "All" }> = [
  { label: "All", value: "All" },
  { label: formatPhoneStatus("Available"), value: "Available" },
  { label: formatPhoneStatus("Sold"), value: "Sold" },
  { label: formatPhoneStatus("With Dealer"), value: "With Dealer" },
  { label: formatPhoneStatus("Returned"), value: "Returned" },
  { label: formatPhoneStatus("Damaged"), value: "Damaged" },
  { label: formatPhoneStatus("Archived"), value: "Archived" },
];

type PhoneRow = {
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

type AppleStorageGroup = {
  key: string;
  storage: string;
  phones: PhoneRow[];
  counts: Record<string, number>;
};

type AppleModelGroup = {
  key: string;
  model: string;
  phones: PhoneRow[];
  storageGroups: AppleStorageGroup[];
};

function searchParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function normalizeGroupValue(value: string | null | undefined) {
  return (value || "Not set").trim().toLowerCase();
}

function displayStorage(value: string | null) {
  return value?.trim() || "Not set";
}

function storageSortValue(storage: string) {
  const normalized = storage.toLowerCase();
  if (normalized.includes("tb")) return Number.parseFloat(normalized) * 1024;
  const gb = Number.parseFloat(normalized);
  return Number.isFinite(gb) ? gb : Number.MAX_SAFE_INTEGER;
}

function buildAppleGroups(phones: PhoneRow[]) {
  const modelGroups = new Map<string, { model: string; phones: PhoneRow[]; storageGroups: Map<string, AppleStorageGroup> }>();

  for (const phone of phones.filter((p) => p.brand.toLowerCase() === "apple")) {
    const modelKey = normalizeGroupValue(phone.model);
    const storage = displayStorage(phone.storage);
    const storageKey = normalizeGroupValue(storage);
    const modelGroup = modelGroups.get(modelKey) ?? {
      model: phone.model,
      phones: [],
      storageGroups: new Map<string, AppleStorageGroup>(),
    };
    modelGroup.phones.push(phone);

    const storageGroup = modelGroup.storageGroups.get(storageKey) ?? {
      key: storageKey,
      storage,
      phones: [],
      counts: {},
    };
    storageGroup.phones.push(phone);
    storageGroup.counts[phone.status] = (storageGroup.counts[phone.status] ?? 0) + 1;
    modelGroup.storageGroups.set(storageKey, storageGroup);
    modelGroups.set(modelKey, modelGroup);
  }

  return Array.from(modelGroups.entries())
    .map(([key, group]): AppleModelGroup => ({
      key,
      model: group.model,
      phones: group.phones,
      storageGroups: Array.from(group.storageGroups.values()).sort((a, b) => {
        const storageSort = storageSortValue(a.storage) - storageSortValue(b.storage);
        return storageSort || a.storage.localeCompare(b.storage);
      }),
    }))
    .sort((a, b) => b.phones.length - a.phones.length || a.model.localeCompare(b.model));
}

function inventoryHref(params: Record<string, string | undefined>) {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value) search.set(key, value);
  });
  const qs = search.toString();
  return qs ? `/inventory?${qs}` : "/inventory";
}

export default async function InventoryPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>> | Record<string, string | string[] | undefined>;
}) {
  const profile = await requireProfileRole();
  const isAdmin = profile.role === "admin";

  const supabase = await createSupabaseOperationalServerClient(profile);
  const resolvedSearchParams = (await searchParams) ?? {};

  const q = searchParam(resolvedSearchParams.q);
  const status = searchParam(resolvedSearchParams.status) ?? "All";
  const view = searchParam(resolvedSearchParams.view) === "all" ? "all" : "apple-groups";
  const selectedModel = searchParam(resolvedSearchParams.model);
  const selectedStorage = searchParam(resolvedSearchParams.storage);

  let query = supabase
    .from("phones")
    .select("id, imei, brand, model, storage, color, battery_health, condition, cost_price, selling_price, status, updated_at")
    .order("updated_at", { ascending: false })
    .limit(300);

  if (status && status !== "All") {
    query = query.eq("status", status as "Available" | "Sold" | "With Dealer" | "Returned" | "Damaged" | "Archived");
  }

  if (q && q.trim().length > 0) {
    const needle = q.trim().replaceAll(",", "");
    query = query.or(`imei.ilike.%${needle}%,brand.ilike.%${needle}%,model.ilike.%${needle}%,storage.ilike.%${needle}%`);
  }

  const phonesResult = await query;
  let phones = phonesResult.data as PhoneRow[] | null;

  if (phonesResult.error && isMissingColumnError(phonesResult.error)) {
    logSupabaseWarning("[My Phones] battery_health column missing; using legacy inventory fallback. Apply migration 0005.", phonesResult.error);
    let legacyQuery = supabase
      .from("phones")
      .select("id, imei, brand, model, storage, color, condition, cost_price, selling_price, status, updated_at")
      .order("updated_at", { ascending: false })
      .limit(300);

    if (status && status !== "All") {
      legacyQuery = legacyQuery.eq("status", status as "Available" | "Sold" | "With Dealer" | "Returned" | "Damaged" | "Archived");
    }

    if (q && q.trim().length > 0) {
      const needle = q.trim().replaceAll(",", "");
      legacyQuery = legacyQuery.or(`imei.ilike.%${needle}%,brand.ilike.%${needle}%,model.ilike.%${needle}%,storage.ilike.%${needle}%`);
    }

    const legacyResult = await legacyQuery;
    phones = ((legacyResult.data ?? []) as Omit<PhoneRow, "battery_health">[]).map((phone) => ({
      ...phone,
      battery_health: null,
    }));
  } else if (phonesResult.error) {
    logSupabaseWarning("[My Phones] Query failed", phonesResult.error);
  }

  const safePhones = phones ?? [];
  const appleGroups = buildAppleGroups(safePhones);
  const selectedModelKey = selectedModel ? normalizeGroupValue(selectedModel) : null;
  const selectedStorageKey = selectedStorage ? normalizeGroupValue(selectedStorage) : null;

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="My Phones"
        subtitle="Grouped iPhone stock first. Individual IMEIs stay one tap away."
        actions={
          <Link href="/add-phone" className="inline-flex h-11 items-center justify-center rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground shadow-sm">
            Add Phone
          </Link>
        }
      />

      <div className="grid grid-cols-2 gap-2 rounded-lg border bg-card p-2 shadow-sm sm:w-fit">
        <Link
          href={inventoryHref({ q, status, view: "all" })}
          className={view === "all" ? "rounded-lg bg-primary px-4 py-2 text-center text-sm font-semibold text-primary-foreground" : "rounded-lg px-4 py-2 text-center text-sm font-semibold text-muted-foreground hover:bg-background"}
        >
          All Phones
        </Link>
        <Link
          href={inventoryHref({ q, status, view: undefined })}
          className={view === "apple-groups" ? "rounded-lg bg-primary px-4 py-2 text-center text-sm font-semibold text-primary-foreground" : "rounded-lg px-4 py-2 text-center text-sm font-semibold text-muted-foreground hover:bg-background"}
        >
          Apple Groups
        </Link>
      </div>

      <form className="flex flex-col gap-4 rounded-2xl border border-black/5 bg-card p-4 shadow-sm sm:p-6 md:flex-row md:items-end" action="/inventory" method="get">
        <input type="hidden" name="view" value={view} />
        <label className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="text-xs font-medium text-muted-foreground">Search</span>
          <input
            name="q"
            defaultValue={q ?? ""}
            placeholder="IMEI, brand, model, storage"
            className="h-12 rounded-xl border bg-background px-4 text-base"
          />
        </label>

        <div className="flex gap-2 overflow-x-auto pb-1 md:max-w-[620px]">
          {STATUS_FILTERS.map((s) => (
            <button
              key={s.label}
              type="submit"
              name="status"
              value={s.value}
              className={
                status === s.value
                  ? "h-11 shrink-0 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground"
                  : "h-11 shrink-0 rounded-xl border bg-card px-4 text-sm text-muted-foreground hover:text-foreground"
              }
            >
              {s.label}
            </button>
          ))}
        </div>
      </form>

      {view === "apple-groups" ? (
        <>
          <section className="grid gap-4 lg:grid-cols-2 lg:gap-6">
            {appleGroups.map((group) => {
              const selectedStorageGroup =
                group.key === selectedModelKey
                  ? group.storageGroups.find((storageGroup) => storageGroup.key === selectedStorageKey)
                  : undefined;
              const selectedMissing = group.key === selectedModelKey && selectedStorageKey && !selectedStorageGroup;

              return (
                <article
                  key={group.key}
                  className={group.key === selectedModelKey ? "rounded-2xl border border-primary bg-card p-4 shadow-sm sm:p-6" : "rounded-2xl border border-black/5 bg-card p-4 shadow-sm sm:p-6"}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-xl font-semibold tracking-tight sm:text-2xl">{group.model}</div>
                      <div className="mt-2 text-sm text-muted-foreground">{group.phones.length} total unit{group.phones.length === 1 ? "" : "s"}</div>
                    </div>
                    <div className="rounded-xl bg-background px-3 py-2 text-xs font-semibold sm:px-4 sm:text-sm">
                      {group.storageGroups.length} storage{group.storageGroups.length === 1 ? "" : "s"}
                    </div>
                  </div>

                  <div className="mt-4 flex flex-col gap-3 sm:mt-6">
                    {group.storageGroups.map((storageGroup) => {
                      const selected = group.key === selectedModelKey && storageGroup.key === selectedStorageKey;
                      return (
                        <Link
                          key={storageGroup.key}
                          href={inventoryHref({ q, status, view: "apple-groups", model: group.model, storage: storageGroup.storage })}
                          className={
                            selected
                              ? "rounded-2xl border border-primary bg-primary/5 p-3 sm:p-4"
                              : "rounded-2xl border bg-background p-3 transition hover:border-gray-300 hover:shadow-sm sm:p-4"
                          }
                        >
                          <div className="flex items-center justify-between gap-3">
                            <div>
                              <div className="text-base font-semibold">
                                {storageGroup.storage} - {storageGroup.counts.Available ?? 0} available
                              </div>
                              <div className="mt-2 text-sm text-muted-foreground">
                                With Dealer: {storageGroup.counts["With Dealer"] ?? 0}
                              </div>
                            </div>
                            <div className="text-right text-sm text-muted-foreground">
                              <div>Total</div>
                              <div className="font-semibold text-foreground">{storageGroup.phones.length}</div>
                            </div>
                          </div>
                        </Link>
                      );
                    })}
                  </div>

                  {selectedStorageGroup ? (
                    <div className="mt-4 rounded-2xl border bg-background p-3 sm:mt-6 sm:p-4">
                      <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
                        <div>
                          <div className="text-base font-semibold">{group.model} - {selectedStorageGroup.storage}</div>
                          <div className="mt-1 text-sm text-muted-foreground">Individual devices in this storage group.</div>
                        </div>
                        <div className="text-sm font-semibold">{selectedStorageGroup.phones.length} total</div>
                      </div>

                      {selectedStorageGroup.phones.length === 0 ? (
                        <div className="mt-3 rounded-lg border border-dashed bg-card p-4 text-sm text-muted-foreground">
                          No phones in this storage group.
                        </div>
                      ) : null}

                      <div className="mt-4 flex flex-col gap-3 lg:hidden">
                        {selectedStorageGroup.phones.map((phone) => (
                          <Link key={phone.id} href={`/phone-details/${encodeURIComponent(phone.imei)}`} className="rounded-2xl border bg-card p-3 sm:p-4">
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <div className="font-mono text-xs">{phone.imei}</div>
                                <div className="mt-1 text-xs text-muted-foreground">Battery Health: {phone.battery_health || "Not set"}</div>
                              </div>
                              <StatusBadge status={phone.status} />
                            </div>
                            {isAdmin ? <div className="mt-2 text-sm font-semibold">{formatMoney(phone.cost_price)}</div> : null}
                          </Link>
                        ))}
                      </div>

                      <div className="mt-3 hidden overflow-auto lg:block">
                        <table className="w-full text-base">
                          <thead className="text-left text-xs text-muted-foreground">
                            <tr>
                              <th className="py-2 pr-4">IMEI</th>
                              <th className="py-2 pr-4">Battery Health</th>
                              <th className="py-2 pr-4">Status</th>
                              {isAdmin ? <th className="py-2">Cost Price</th> : null}
                            </tr>
                          </thead>
                          <tbody>
                            {selectedStorageGroup.phones.map((phone) => (
                              <tr key={phone.id} className="border-t">
                                <td className="py-3 pr-4">
                                  <Link href={`/phone-details/${encodeURIComponent(phone.imei)}`} className="font-mono text-xs hover:underline">
                                    {phone.imei}
                                  </Link>
                                </td>
                                <td className="py-3 pr-4">{phone.battery_health || "Not set"}</td>
                                <td className="py-3 pr-4"><StatusBadge status={phone.status} /></td>
                                {isAdmin ? <td className="py-3">{formatMoney(phone.cost_price)}</td> : null}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ) : null}

                  {selectedMissing ? (
                    <div className="mt-6 rounded-2xl border border-dashed bg-background p-5 text-base text-muted-foreground">
                      No phones in this storage group.
                    </div>
                  ) : null}
                </article>
              );
            })}
            {appleGroups.length === 0 ? (
              <div className="sm:col-span-2 xl:col-span-3">
                <EmptyState title="No Apple phones found" description="Add an iPhone or clear your filters to see grouped Apple stock." />
              </div>
            ) : null}
          </section>
          {appleGroups.length > 0 && (!selectedModelKey || !selectedStorageKey) ? (
            <div className="rounded-2xl border border-dashed bg-card p-5 text-base text-muted-foreground">
              Select a storage row to view individual IMEIs and battery health.
            </div>
          ) : null}
        </>
      ) : (
        <>
          <div className="flex flex-col gap-3 lg:hidden">
            {safePhones.length === 0 ? (
              <EmptyState title="No phones found" description="Add a phone or clear your filters to see My Phones here." />
            ) : (
              safePhones.map((p) => (
                <Link key={p.id} href={`/phone-details/${encodeURIComponent(p.imei)}`} className="rounded-lg border bg-card p-3 shadow-sm sm:p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold">{p.brand} {p.model}</div>
                      <div className="mt-1 text-xs text-muted-foreground">IMEI: {p.imei}</div>
                    </div>
                    <StatusBadge status={p.status} />
                  </div>
                  <div className="mt-3 text-xs text-muted-foreground">
                    {[p.storage ? `${p.storage} storage` : null, p.color].filter(Boolean).join(" / ")}
                  </div>
                  <div className="mt-2 text-sm font-semibold">{formatMoney(p.selling_price)}</div>
                </Link>
              ))
            )}
          </div>

          <div className="hidden rounded-lg border bg-card p-4 shadow-sm lg:block">
            <div className="overflow-auto">
              <table className="w-full text-sm">
                <thead className="text-left">
                  <tr className="text-xs text-muted-foreground">
                    <th className="py-2 pr-4">IMEI</th>
                    <th className="py-2 pr-4">Phone</th>
                    <th className="py-2 pr-4">Condition</th>
                    <th className="py-2 pr-4">Status</th>
                    <th className="py-2 pr-4">Selling</th>
                    <th className="py-2">Last Updated</th>
                  </tr>
                </thead>
                <tbody>
                  {safePhones.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8">
                        <EmptyState title="No phones found" description="Add a phone or clear your filters to see My Phones here." />
                      </td>
                    </tr>
                  ) : (
                    safePhones.map((p) => (
                      <tr key={p.id} className="border-t">
                        <td className="py-3 pr-4 font-mono text-xs">{p.imei}</td>
                        <td className="py-3 pr-4">
                          <Link href={`/phone-details/${encodeURIComponent(p.imei)}`} className="font-semibold hover:underline">
                            {p.brand} {p.model}
                          </Link>
                          <div className="text-xs text-muted-foreground">{[p.storage, p.color].filter(Boolean).join(" / ")}</div>
                        </td>
                        <td className="py-3 pr-4">{p.condition}</td>
                        <td className="py-3 pr-4"><StatusBadge status={p.status} /></td>
                        <td className="py-3 pr-4">{formatMoney(p.selling_price)}</td>
                        <td className="py-3 text-xs text-muted-foreground">{p.updated_at ? new Date(p.updated_at).toLocaleDateString("en-GB") : ""}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      <Link
        href="/add-phone"
        className="fixed bottom-24 right-4 z-30 flex h-14 w-14 items-center justify-center rounded-lg bg-primary text-2xl font-semibold text-primary-foreground shadow-lg lg:hidden"
        aria-label="Add phone"
      >
        +
      </Link>
    </div>
  );
}
