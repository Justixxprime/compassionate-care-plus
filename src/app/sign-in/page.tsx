import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import {
  isPortalUnavailableError,
  portalDatabaseConfigured,
} from "@/lib/app/portal-availability";
import { PortalClosed } from "@/components/app/portal-closed";
import { SignInForm } from "./sign-in-form";

// This page reads the signed-in person from the database, so it must run on
// every request, never be built once ahead of time.
export const dynamic = "force-dynamic";

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ passwordReset?: string }>;
}) {
  // A website with no database attached (for example the public demo site)
  // shows a calm screen instead of a raw server error. This changes which
  // screen is drawn, never who is let in.
  if (!portalDatabaseConfigured()) {
    return <PortalClosed />;
  }

  let user: Awaited<ReturnType<typeof getCurrentUser>>;
  try {
    user = await getCurrentUser();
  } catch (err) {
    // The database is set but cannot be reached, or has no tables yet.
    // Anything else is a real bug and is re-thrown so it still gets logged.
    if (isPortalUnavailableError(err)) {
      console.error("Portal unavailable: the database could not be used.");
      return <PortalClosed />;
    }
    throw err;
  }

  if (user) {
    redirect("/dashboard");
  }

  const { passwordReset } = await searchParams;

  return (
    <div className="min-h-screen bg-ink px-5 py-5 sm:p-8 lg:p-12">
      <div className="mx-auto grid min-h-[calc(100vh-2.5rem)] max-w-6xl overflow-hidden bg-paper shadow-[0_28px_80px_-35px_rgba(0,0,0,.7)] lg:grid-cols-[.95fr_1.05fr]">
        <aside className="relative hidden overflow-hidden bg-pine p-10 text-white lg:block">
          <div aria-hidden="true" className="absolute inset-0 opacity-70 [background:radial-gradient(circle_at_15%_20%,rgba(240,217,168,.32),transparent_25%),radial-gradient(circle_at_80%_85%,rgba(255,255,255,.13),transparent_32%)]" />
          <div className="relative flex h-full flex-col justify-between">
            <div><p className="font-display text-h2">Cheliv</p><p className="mt-1 text-body-sm text-white/65">Compassionate Care Plus</p></div>
            <div><p className="text-label font-semibold uppercase tracking-[.2em] text-marigold">Secure portal</p><h1 className="mt-5 max-w-md font-display text-[clamp(2.5rem,4vw,4rem)] leading-[1.02]">Care information, shared only with the right people.</h1><p className="mt-6 max-w-sm text-body text-white/72">Your account is protected with private sessions, permission checks, and additional verification for staff.</p></div>
            <p className="text-caption text-white/55">For staff, patients, authorized family members, and referral partners.</p>
          </div>
        </aside>
        <div className="mx-auto flex w-full max-w-md flex-col justify-center px-6 py-14 sm:px-10">
          <p className="text-label font-semibold uppercase tracking-[.18em] text-pine">Secure portal</p>
          <p className="mt-3 font-display text-[clamp(2.35rem,5vw,3.5rem)] leading-none text-ink">Welcome back.</p>
          <p className="mt-4 text-body text-slate">Sign in to access the part of care you are authorized to see.</p>
      {passwordReset === "1" ? (
        <p role="status" className="mt-5 rounded-md bg-success-bg px-3 py-2 text-body-sm text-ink">
          Password changed. Please sign in with your new password.
        </p>
      ) : null}
      <SignInForm />
          <p className="mt-8 border-t border-border pt-5 text-caption leading-relaxed text-slate">Do not share your password or recovery codes. If you need help accessing your account, use the recovery link above.</p>
        </div>
      </div>
    </div>
  );
}
