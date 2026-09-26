import { RecoveryRequestForm } from "./recovery-request-form";

export const dynamic = "force-dynamic";

export default function ForgotPasswordPage() {
  return (
    <div className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-6">
      <p className="font-display text-h1 text-ink">Reset password</p>
      <p className="mt-3 text-body text-slate">Enter your account email. If recovery is available for it, we will send a secure link.</p>
      <RecoveryRequestForm />
    </div>
  );
}
