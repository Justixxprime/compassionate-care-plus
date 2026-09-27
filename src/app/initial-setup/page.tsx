import { PortalClosed } from "@/components/app/portal-closed";
import { isPortalUnavailableError, portalDatabaseConfigured } from "@/lib/app/portal-availability";
import { firstAdminSetupAvailable } from "@/lib/auth/first-admin";
import { FirstAdminForm } from "./first-admin-form";

export const dynamic = "force-dynamic";

export default async function InitialSetupPage() {
  if (!portalDatabaseConfigured()) return <PortalClosed />;
  let setupAvailable: boolean | null = null;
  try {
    setupAvailable = await firstAdminSetupAvailable();
  } catch (error) {
    if (!isPortalUnavailableError(error)) throw error;
  }

  if (setupAvailable === null) return <PortalClosed />;
  if (!setupAvailable) return <SetupUnavailable />;

  return (
    <div className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-6 py-12">
      <p className="font-display text-h1 text-ink">Create the first administrator</p>
      <p className="mt-3 text-body text-slate">This one-time screen creates the owner account for this empty Cheliv database. Afterward, it closes forever.</p>
      <FirstAdminForm />
    </div>
  );
}

function SetupUnavailable() {
  return (
    <div className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-6">
      <p className="font-display text-h1 text-ink">Setup unavailable</p>
      <p className="mt-3 text-body text-slate">An administrator account already exists, or private setup has not been enabled.</p>
    </div>
  );
}
