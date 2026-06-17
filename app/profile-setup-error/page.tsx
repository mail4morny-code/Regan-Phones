import Link from "next/link";

export default function ProfileSetupErrorPage() {
  return (
    <main className="min-h-dvh bg-background px-4 py-8">
      <div className="mx-auto max-w-md rounded-lg border bg-card p-5 shadow-sm">
        <h1 className="text-2xl font-bold tracking-tight">Profile setup needs attention</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Your account is signed in, but Regan Phones could not finish setting up your account. Ask the owner to check your access, then try again.
        </p>
        <div className="mt-5 flex flex-col gap-2 sm:flex-row">
          <Link href="/dashboard" className="inline-flex h-11 items-center justify-center rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground">
            Retry Dashboard
          </Link>
          <Link href="/login" className="inline-flex h-11 items-center justify-center rounded-lg border bg-card px-4 text-sm font-semibold">
            Back to Login
          </Link>
        </div>
      </div>
    </main>
  );
}
