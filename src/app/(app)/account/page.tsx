import { PageHeader } from "@/components/app/page-header";
import { AccountSettingsForm } from "./account-settings-form";
import { requireUser } from "@/lib/app/access";
import { InstallChelivApp } from "@/components/app/install-cheliv-app";
import { SuperAdminTransferForm } from "./super-admin-transfer-form";
import { getSuperAdminRecipients } from "@/lib/account-settings";
import Link from "next/link";
import { MonitorSmartphone, ShieldCheck } from "lucide-react";

export const metadata = { title: "My account" };

export default async function AccountPage() {
  const user = await requireUser();
  const roles = user.userRoles.map((entry) => entry.role.name).join(", ") || "No role assigned";
  const isSuperAdmin = user.userRoles.some((entry) => entry.role.key === "SUPER_ADMIN");
  const recipients = isSuperAdmin ? await getSuperAdminRecipients(user.id) : [];
  return (
    <>
      <PageHeader title="My account" description="Manage your own sign-in details. Your role is managed separately to protect access to patient information." />
      <div className="mb-6 rounded-md border border-border bg-sage px-4 py-3 text-body-sm text-ink">
        <span className="font-semibold">Your access:</span> {roles}
      </div>
      <AccountSettingsForm name={user.name} email={user.email} />
      <div className="mt-6 flex max-w-3xl flex-wrap gap-3">
        <Link href="/security/mfa" className="inline-flex min-h-11 items-center gap-2 rounded-md border border-border-strong bg-white px-4 text-body-sm font-medium text-ink transition-colors hover:bg-sage"><ShieldCheck className="h-4 w-4" aria-hidden="true" />Sign-in security</Link>
        <Link href="/security/sessions" className="inline-flex min-h-11 items-center gap-2 rounded-md border border-border-strong bg-white px-4 text-body-sm font-medium text-ink transition-colors hover:bg-sage"><MonitorSmartphone className="h-4 w-4" aria-hidden="true" />Active sessions</Link>
      </div>
      {isSuperAdmin ? <div className="mt-6"><SuperAdminTransferForm recipients={recipients} /></div> : null}
      <div className="mt-6 max-w-3xl rounded-md border border-border bg-white p-5 sm:p-6">
        <h2 className="font-display text-h3 text-ink">Install Cheliv</h2>
        <p className="mt-2 text-body-sm text-slate">Install the website as an app for quicker access from a phone home screen, computer dock, or taskbar.</p>
        <div className="mt-4"><InstallChelivApp /></div>
      </div>
    </>
  );
}
