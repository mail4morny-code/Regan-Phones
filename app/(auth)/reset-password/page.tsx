import { ResetPasswordForm } from "@/components/auth/ResetPasswordForm";

export const dynamic = "force-dynamic";

export default function ResetPasswordPage() {
  return (
    <div className="min-h-dvh bg-background px-4 py-8">
      <div className="mx-auto flex max-w-md flex-col gap-4 pt-6">
        <div className="rounded-lg border bg-card p-5 shadow-sm">
          <h1 className="text-3xl font-bold tracking-tight">Choose New Password</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Use the secure link from your email to set a new password.
          </p>
        </div>
        <ResetPasswordForm />
      </div>
    </div>
  );
}
