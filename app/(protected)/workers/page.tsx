import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";
import { WorkerForm } from "@/components/workers/WorkerForm";
import { requireProfileRole } from "@/lib/auth/requireProfile";
import { toggleWorkerActiveAction } from "@/lib/auth/workerActions";
import { formatRole } from "@/lib/format/display";
import { createSupabaseAppServerClient } from "@/lib/supabase/appServer";
import { isMissingColumnError, logSupabaseWarning } from "@/lib/supabase/errors";

type WorkerRow = {
  id: string;
  full_name: string | null;
  email: string | null;
  phone_number: string | null;
  role: string;
  is_active: boolean;
  created_at: string;
};

export default async function WorkersPage() {
  const profile = await requireProfileRole(["admin"]);
  const supabase = await createSupabaseAppServerClient();

  const workersResult = await supabase
    .from("profiles")
    .select("id, full_name, email, phone_number, role, is_active, created_at")
    .eq("role", "worker")
    .order("created_at", { ascending: false });
  let workers = workersResult.data as WorkerRow[] | null;
  if (workersResult.error && isMissingColumnError(workersResult.error)) {
    logSupabaseWarning("[Workers] phone_number column missing; using legacy fallback. Apply migration 0006.", workersResult.error);
    const legacy = await supabase
      .from("profiles")
      .select("id, full_name, email, role, is_active, created_at")
      .eq("role", "worker")
      .order("created_at", { ascending: false });
    workers = ((legacy.data ?? []) as Omit<WorkerRow, "phone_number">[]).map((worker) => ({ ...worker, phone_number: null }));
  } else if (workersResult.error) {
    logSupabaseWarning("[Workers] Worker list could not be loaded", workersResult.error);
  }

  const safeWorkers = workers ?? [];

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Workers"
        subtitle="Add workers and control who can use Regan Phones."
        actions={<div className="text-sm text-muted-foreground">Signed in as {profile.email ?? profile.id}</div>}
      />

      <WorkerForm />

      <section className="rounded-2xl border border-black/5 bg-card p-6 shadow-sm md:p-8">
        <div className="text-2xl font-semibold tracking-tight">Workers</div>
        <div className="mt-6 grid gap-4 xl:grid-cols-2">
          {safeWorkers.map((w) => (
            <div key={w.id} className="rounded-2xl border bg-background p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-base font-semibold">{w.full_name ?? "No name"}</div>
                  <div className="mt-2 text-sm text-muted-foreground">{w.email ?? ""}</div>
                  <div className="mt-1 text-sm text-muted-foreground">{w.phone_number ?? "No phone number"}</div>
                </div>
                <div className={w.is_active ? "rounded-full border bg-card px-3 py-1 text-xs font-semibold" : "rounded-full border border-red-200 bg-red-50 px-3 py-1 text-xs font-semibold text-red-700"}>
                  {w.is_active ? "Active" : "Disabled"}
                </div>
              </div>
              <div className="mt-4 grid gap-2 text-sm text-muted-foreground sm:grid-cols-2">
                <div>Access: <span className="font-semibold text-foreground">{formatRole(w.role)}</span></div>
                <div>Added {new Date(w.created_at).toLocaleDateString("en-GB")}</div>
              </div>
              <div className="mt-4 flex justify-end">
                <form action={toggleWorkerActiveAction}>
                  <input type="hidden" name="worker_id" value={w.id} />
                  <input type="hidden" name="next_active" value={String(!w.is_active)} />
                  <button className={w.is_active ? "h-10 rounded-xl border border-red-200 bg-red-50 px-4 text-sm font-semibold text-red-700" : "h-10 rounded-xl border bg-card px-4 text-sm font-semibold"}>
                    {w.is_active ? "Disable Worker" : "Enable Worker"}
                  </button>
                </form>
              </div>
            </div>
          ))}
          {safeWorkers.length === 0 ? (
            <div className="xl:col-span-2">
              <EmptyState title="No workers found" description="Create the first worker account with the Add Worker form." />
            </div>
          ) : null}
        </div>
      </section>
    </div>
  );
}
