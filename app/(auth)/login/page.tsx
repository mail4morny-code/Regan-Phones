import { LoginForm } from "@/components/auth/LoginForm";
import { createSupabaseAppServerClient } from "@/lib/supabase/appServer";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const supabase = await createSupabaseAppServerClient();
  const { data } = await supabase.auth.getUser();
  if (data.user) redirect("/dashboard");

  return (
    <div className="min-h-dvh bg-background px-4 py-8">
      <div className="mx-auto flex max-w-md flex-col gap-4 pt-6">
        <div className="rounded-lg border bg-card p-5 shadow-sm">
          <h1 className="text-3xl font-bold tracking-tight">Regan Phones</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Sign in with your owner or worker credentials.
          </p>
        </div>
        <LoginForm />
      </div>
    </div>
  );
}

