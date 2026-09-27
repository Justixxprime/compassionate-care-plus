"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/ui/password-input";
import { transferSuperAdminAction } from "@/lib/account-settings-actions";
import type { AccountSettingsResult, SuperAdminRecipient } from "@/lib/account-settings";

const initialState: AccountSettingsResult = { ok: false, error: "" };

export function SuperAdminTransferForm({ recipients }: { recipients: SuperAdminRecipient[] }) {
  const [state, action, pending] = useActionState(transferSuperAdminAction, initialState);
  if (!recipients.length) return <p className="text-body-sm text-slate">Create another Administrator account first. Only an existing Administrator can receive Super Admin access.</p>;
  return (
    <form action={action} className="max-w-xl rounded-md border border-marigold/50 bg-white p-5 sm:p-6" noValidate>
      <h2 className="font-display text-h3 text-ink">Transfer Super Admin</h2>
      <p className="mt-2 text-body-sm text-slate">Use this when handing Cheliv to the organization owner. The selected Administrator becomes Super Admin; you remain an Administrator.</p>
      <div className="mt-5">
        <Label htmlFor="super-admin-target">New Super Admin</Label>
        <select id="super-admin-target" name="targetUserId" required className="mt-1.5 h-11 w-full rounded-md border border-border-strong bg-white px-3 text-body text-ink focus-visible:outline-none">
          {recipients.map((person) => <option key={person.id} value={person.id}>{person.name} ({person.email})</option>)}
        </select>
      </div>
      <div className="mt-5">
        <Label htmlFor="super-admin-password">Your current password</Label>
        <PasswordInput id="super-admin-password" name="currentPassword" autoComplete="current-password" required />
      </div>
      {state.ok ? <p role="status" className="mt-4 rounded-md bg-success-bg px-3 py-2 text-body-sm text-success">{state.message}</p> : null}
      {!state.ok && state.error ? <p role="alert" className="mt-4 rounded-md bg-danger-bg px-3 py-2 text-body-sm text-danger">{state.error}</p> : null}
      <Button type="submit" variant="secondary" className="mt-5" disabled={pending}>{pending ? "Transferring..." : "Transfer Super Admin"}</Button>
    </form>
  );
}
