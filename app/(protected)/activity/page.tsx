import { redirect } from "next/navigation";

type SearchParams =
  | Promise<Record<string, string | string[] | undefined>>
  | Record<string, string | string[] | undefined>;

function appendParam(params: URLSearchParams, key: string, value: string | string[] | undefined) {
  if (Array.isArray(value)) {
    value.forEach((item) => params.append(key, item));
    return;
  }
  if (value) params.set(key, value);
}

export default async function ActivityPage({
  searchParams,
}: {
  searchParams?: SearchParams;
}) {
  const resolved = (await searchParams) ?? {};
  const params = new URLSearchParams();
  appendParam(params, "q", resolved.q);
  appendParam(params, "action", resolved.action);
  appendParam(params, "date", resolved.date);
  appendParam(params, "user", resolved.user);

  redirect(`/notifications${params.toString() ? `?${params.toString()}` : ""}`);
}
