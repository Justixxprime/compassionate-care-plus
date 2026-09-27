"use client";

import { useActionState } from "react";
import { createFirstAdminAction } from "@/lib/auth/first-admin-actions";
import type { FirstAdminResult } from "@/lib/auth/first-admin";
import { buttonVariants } from "@/components/ui/button";
import { PasswordInput } from "@/components/ui/password-input";
import { cn } from "@/lib/cn";

const initialState: FirstAdminResult = { ok: false, error: "" };
const inputStyles = "mt-1.5 h-11 w-full rounded-md border border-border-strong px-3 text-body focus:border-pine focus:outline-none focus:ring-2 focus:ring-pine/30";

export function FirstAdminForm() {
  const [state, action, pending] = useActionState(createFirstAdminAction, initialState);
  return (
    <form action={action} className="mt-8 space-y-5" noValidate>
      <div>
        <label htmlFor="name" className="text-label font-semibold text-ink">Your full name</label>
        <input id="name" name="name" required autoComplete="name" className={inputStyles} />
      </div>
      <div>
        <label htmlFor="email" className="text-label font-semibold text-ink">Your email</label>
        <input id="email" name="email" type="email" required autoComplete="email" className={inputStyles} />
      </div>
      <div>
        <label htmlFor="password" className="text-label font-semibold text-ink">Choose a password</label>
        <PasswordInput id="password" name="password" required minLength={10} autoComplete="new-password" className={inputStyles.replace("mt-1.5 ", "")} />
      </div>
      <div>
        <label htmlFor="confirmPassword" className="text-label font-semibold text-ink">Confirm password</label>
        <PasswordInput id="confirmPassword" name="confirmPassword" required minLength={10} autoComplete="new-password" className={inputStyles.replace("mt-1.5 ", "")} />
      </div>
      <div>
        <label htmlFor="setupToken" className="text-label font-semibold text-ink">Private setup code</label>
        <PasswordInput id="setupToken" name="setupToken" required minLength={32} autoComplete="off" className={inputStyles.replace("mt-1.5 ", "")} />
        <p className="mt-1.5 text-body-sm text-slate">This is the secret you saved in Vercel. It is not your password.</p>
      </div>
      {!state.ok && state.error ? <p role="alert" className="rounded-md bg-danger-bg px-3 py-2 text-body-sm text-danger">{state.error}</p> : null}
      <button type="submit" disabled={pending} className={cn(buttonVariants({ size: "lg" }), "w-full")}>
        {pending ? "Creating secure account..." : "Create administrator account"}
      </button>
    </form>
  );
}
