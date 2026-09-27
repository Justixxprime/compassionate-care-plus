"use client";

import Link from "next/link";
import { useActionState } from "react";
import {
  resetPasswordAction,
} from "@/lib/auth/password-recovery-actions";
import type { PasswordResetResult } from "@/lib/auth/password-recovery";
import { buttonVariants } from "@/components/ui/button";
import { PasswordInput } from "@/components/ui/password-input";
import { cn } from "@/lib/cn";

const initialState: PasswordResetResult = { ok: false };
const inputStyles =
  "mt-1.5 h-11 w-full rounded-md border border-border-strong px-3 text-body " +
  "focus:border-pine focus:outline-none focus:ring-2 focus:ring-pine/30";

export function ResetPasswordForm({ token }: { token: string }) {
  const [state, action, pending] = useActionState(resetPasswordAction, initialState);
  if (!token) {
    return <Link href="/forgot-password" className="mt-8 block text-body font-medium text-pine underline underline-offset-2">Request a new recovery link</Link>;
  }
  return (
    <form action={action} className="mt-8 space-y-5" noValidate>
      <input type="hidden" name="token" value={token} />
      <div>
        <label htmlFor="password" className="text-label font-semibold text-ink">New password</label>
        <PasswordInput id="password" name="password" required minLength={10} autoComplete="new-password" className={inputStyles.replace("mt-1.5 ", "")} />
      </div>
      <div>
        <label htmlFor="confirmPassword" className="text-label font-semibold text-ink">Confirm new password</label>
        <PasswordInput id="confirmPassword" name="confirmPassword" required minLength={10} autoComplete="new-password" className={inputStyles.replace("mt-1.5 ", "")} />
      </div>
      {state.error ? <p role="alert" className="rounded-md bg-danger-bg px-3 py-2 text-body-sm text-danger">{state.error}</p> : null}
      <button type="submit" disabled={pending} className={cn(buttonVariants({ size: "lg" }), "w-full")}>
        {pending ? "Changing password..." : "Change password"}
      </button>
    </form>
  );
}
