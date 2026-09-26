import { ResetPasswordForm } from "./reset-password-form";

export const dynamic = "force-dynamic";

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token = "" } = await searchParams;
  return (
    <div className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-6">
      <p className="font-display text-h1 text-ink">Choose a new password</p>
      <p className="mt-3 text-body text-slate">Use at least 10 characters. Changing it signs out every other device.</p>
      <ResetPasswordForm token={token} />
    </div>
  );
}
