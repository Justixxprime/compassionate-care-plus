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
    <div className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-6">
      <p className="font-display text-h1 text-ink">Sign in</p>
      <p className="mt-3 text-body text-slate">
        Portal access for staff, patients and families.
      </p>
      {passwordReset === "1" ? (
        <p role="status" className="mt-5 rounded-md bg-success-bg px-3 py-2 text-body-sm text-ink">
          Password changed. Please sign in with your new password.
        </p>
      ) : null}
      <SignInForm />
    </div>
  );
}
