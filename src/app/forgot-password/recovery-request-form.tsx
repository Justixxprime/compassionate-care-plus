"use client";

import Link from "next/link";
import { useActionState } from "react";
import {
  requestPasswordRecoveryAction,
  type RecoveryRequestState,
} from "@/lib/auth/password-recovery-actions";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/cn";

const initialState: RecoveryRequestState = {};
const inputStyles =
  "mt-1.5 h-11 w-full rounded-md border border-border-strong px-3 text-body " +
  "focus:border-pine focus:outline-none focus:ring-2 focus:ring-pine/30";

export function RecoveryRequestForm() {
  const [state, action, pending] = useActionState(requestPasswordRecoveryAction, initialState);
  return (
    <form action={action} className="mt-8 space-y-5" noValidate>
      <div>
        <label htmlFor="email" className="text-label font-semibold text-ink">Email</label>
        <input id="email" name="email" type="email" required autoComplete="email" className={inputStyles} />
      </div>
      {state.message ? <p role="status" className="rounded-md bg-success-bg px-3 py-2 text-body-sm text-ink">{state.message}</p> : null}
      <button type="submit" disabled={pending} className={cn(buttonVariants({ size: "lg" }), "w-full")}>
        {pending ? "Sending..." : "Send recovery link"}
      </button>
      <Link href="/sign-in" className="block text-center text-body-sm font-medium text-pine underline underline-offset-2">Back to sign in</Link>
    </form>
  );
}
