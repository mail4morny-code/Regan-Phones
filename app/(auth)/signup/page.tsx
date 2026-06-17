import { SignupForm } from "@/components/auth/SignupForm";
import { createSupabaseAppServerClient } from "@/lib/supabase/appServer";
import { tryCreateSupabaseServiceRoleClient } from "@/lib/supabase/serviceRole";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function SignupPage() {
  const supabase = await createSupabaseAppServerClient();
  const { data } = await supabase.auth.getUser();
  if (data.user) redirect("/dashboard");
  const service = tryCreateSupabaseServiceRoleClient();
  const { count } = service
    ? await service.from("profiles").select("id", { count: "exact", head: true })
    : { count: null };
  const setupLocked = typeof count === "number" && count > 0;

  return (
    <div className="min-h-dvh bg-background px-4 py-8">
      <div className="mx-auto flex max-w-md flex-col gap-4 pt-6">
        <div className="rounded-lg border bg-card p-5 shadow-sm">
          <h1 className="text-3xl font-bold tracking-tight">Regan Phones</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Owner setup only. Workers are created by the owner from the Workers page.
          </p>
        </div>
        {setupLocked ? (
          <div className="rounded-2xl border bg-card p-6 text-sm shadow-sm">
            <div className="text-lg font-semibold">Signup is closed</div>
            <p className="mt-2 text-muted-foreground">
              This system already has an owner account. Workers should sign in with credentials created by the owner.
            </p>
            <a href="/login" className="mt-4 inline-flex h-11 items-center rounded-xl bg-primary px-4 font-semibold text-primary-foreground">
              Go to login
            </a>
          </div>
        ) : (
          <SignupForm />
        )}

        <div className="text-center text-sm">
          <a
            href="/login"
            className="font-medium text-foreground underline underline-offset-4"
          >
            Already have an account? Sign in
          </a>
        </div>
      </div>
    </div>
  );
}


