import { ForgotPasswordForm } from "@/components/auth/ForgotPasswordForm";

export const dynamic = "force-dynamic";

export default function ForgotPasswordPage() {
  return (
    <div className="min-h-dvh bg-background px-4 py-8">
      <div className="mx-auto flex max-w-md flex-col gap-4 pt-6">
        <div className="rounded-lg border bg-card p-5 shadow-sm">
          <h1 className="text-3xl font-bold tracking-tight">Forgot Password</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Enter your email and Regan Phones will send a secure reset link.
          </p>
        </div>
        <ForgotPasswordForm />
      </div>
    </div>
  );
}
