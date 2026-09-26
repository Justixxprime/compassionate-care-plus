import { redirect } from "next/navigation";
import { consumeMfaChallengeUser } from "@/lib/auth/session";
import { MfaChallengeForm } from "./mfa-challenge-form";

export const dynamic = "force-dynamic";

export default async function MfaChallengePage() {
  const user = await consumeMfaChallengeUser();
  if (!user) redirect("/sign-in");
  return (
    <div className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-6">
      <p className="font-display text-h1 text-ink">Verify sign-in</p>
      <p className="mt-3 text-body text-slate">Enter the newest code from your authenticator app, or one unused recovery code.</p>
      <MfaChallengeForm />
    </div>
  );
}
