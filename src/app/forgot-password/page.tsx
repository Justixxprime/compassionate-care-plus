import { RecoveryRequestForm } from "./recovery-request-form";
import { PortalClosed } from "@/components/app/portal-closed";
import { portalDatabaseConfigured } from "@/lib/app/portal-availability";

export const dynamic = "force-dynamic";

export default function ForgotPasswordPage() {
  // Recovery is a secure-portal feature: when a Vercel deployment has no
  // hosted database, do not render a form whose action would fail later.
  // This is the same honest boundary used by /sign-in.
  if (!portalDatabaseConfigured()) return <PortalClosed />;

  return (
    <div className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-6">
      <p className="font-display text-h1 text-ink">Reset password</p>
      <p className="mt-3 text-body text-slate">Enter your account email. If recovery is available for it, we will send a secure link.</p>
      <RecoveryRequestForm />
    </div>
  );
}
