import { PageHeader } from "@/components/ui/PageHeader";
import { ChangePasswordForm } from "@/components/settings/ChangePasswordForm";
import { requireProfileRole } from "@/lib/auth/requireProfile";
import { signOutAction } from "@/lib/auth/signOutAction";
import { formatRole } from "@/lib/format/display";

export default async function SettingsPage() {
  const profile = await requireProfileRole();

  return (
    <div className="flex flex-col gap-6 md:gap-8">
      <PageHeader
        title="Settings"
        subtitle="Manage your account session and basic profile information."
      />

      <section className="rounded-2xl border border-black/5 bg-card p-4 shadow-sm sm:p-6 md:p-8">
        <h2 className="text-xl font-semibold tracking-tight sm:text-2xl">Account</h2>
        <div className="mt-4 grid gap-3 text-sm sm:mt-6 sm:grid-cols-2 sm:text-base">
          <div className="rounded-2xl border bg-background p-4 sm:p-5">
            <div className="text-sm text-muted-foreground">Signed in as</div>
            <div className="mt-2 font-semibold">{profile.email ?? profile.id}</div>
          </div>
          <div className="rounded-2xl border bg-background p-4 sm:p-5">
            <div className="text-sm text-muted-foreground">Role</div>
            <div className="mt-2 font-semibold">{formatRole(profile.role)}</div>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-black/5 bg-card p-4 shadow-sm sm:p-6 md:p-8">
        <h2 className="text-xl font-semibold tracking-tight sm:text-2xl">Password</h2>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base sm:leading-7">
          Workers should change their temporary password after first login.
        </p>
        <ChangePasswordForm />
      </section>

      <section className="rounded-2xl border border-red-100 bg-card p-4 shadow-sm sm:p-6 md:p-8">
        <h2 className="text-xl font-semibold tracking-tight sm:text-2xl">Session</h2>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base sm:leading-7">
          Sign out when you are done using this device.
        </p>
        <form action={signOutAction} className="mt-6">
          <button className="h-12 w-full rounded-xl bg-red-600 px-5 text-sm font-semibold text-white transition hover:bg-red-700 sm:w-auto">
            Sign out
          </button>
        </form>
      </section>
    </div>
  );
}
