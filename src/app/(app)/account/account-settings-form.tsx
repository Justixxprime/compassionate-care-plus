"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/ui/password-input";
import { changeOwnPasswordAction, updateOwnProfileAction } from "@/lib/account-settings-actions";
import type { AccountSettingsResult } from "@/lib/account-settings";

const initialState: AccountSettingsResult = { ok: false, error: "" };

function ResultMessage({ state }: { state: AccountSettingsResult }) {
  if (state.ok) return <p role="status" className="mt-4 rounded-md bg-success-bg px-3 py-2 text-body-sm text-success">{state.message}</p>;
  return state.error ? <p role="alert" className="mt-4 rounded-md bg-danger-bg px-3 py-2 text-body-sm text-danger">{state.error}</p> : null;
}

export function AccountSettingsForm({ name, email }: { name: string; email: string }) {
  const [profileState, profileAction, profilePending] = useActionState(updateOwnProfileAction, initialState);
  const [passwordState, passwordAction, passwordPending] = useActionState(changeOwnPasswordAction, initialState);

  return (
    <div className="grid max-w-3xl gap-6 lg:grid-cols-2">
      <form action={profileAction} className="rounded-md border border-border bg-white p-5 sm:p-6" noValidate>
        <h2 className="font-display text-h3 text-ink">Profile details</h2>
        <p className="mt-2 text-body-sm text-slate">Update the name and email shown for your own account. Confirm your password to save.</p>
        <div className="mt-5">
          <Label htmlFor="account-name">Full name</Label>
          <Input id="account-name" name="name" defaultValue={name} autoComplete="name" required />
        </div>
        <div className="mt-5">
          <Label htmlFor="account-email">Email address</Label>
          <Input id="account-email" name="email" type="email" defaultValue={email} autoComplete="email" required />
        </div>
        <div className="mt-5">
          <Label htmlFor="profile-current-password">Current password</Label>
          <PasswordInput id="profile-current-password" name="currentPassword" autoComplete="current-password" required />
        </div>
        <ResultMessage state={profileState} />
        <Button type="submit" className="mt-5" disabled={profilePending}>{profilePending ? "Saving..." : "Save profile"}</Button>
      </form>

      <form action={passwordAction} className="rounded-md border border-border bg-white p-5 sm:p-6" noValidate>
        <h2 className="font-display text-h3 text-ink">Change password</h2>
        <p className="mt-2 text-body-sm text-slate">Use at least 10 characters. Saving signs out every other device using this account.</p>
        <div className="mt-5">
          <Label htmlFor="password-current">Current password</Label>
          <PasswordInput id="password-current" name="currentPassword" autoComplete="current-password" required />
        </div>
        <div className="mt-5">
          <Label htmlFor="password-new">New password</Label>
          <PasswordInput id="password-new" name="password" autoComplete="new-password" minLength={10} required />
        </div>
        <div className="mt-5">
          <Label htmlFor="password-confirm">Confirm new password</Label>
          <PasswordInput id="password-confirm" name="confirmPassword" autoComplete="new-password" minLength={10} required />
        </div>
        <ResultMessage state={passwordState} />
        <Button type="submit" className="mt-5" disabled={passwordPending}>{passwordPending ? "Changing..." : "Change password"}</Button>
      </form>
    </div>
  );
}
