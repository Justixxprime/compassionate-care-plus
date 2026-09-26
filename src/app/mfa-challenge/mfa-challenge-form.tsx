"use client";

import { useActionState } from "react";
import { completeMfaChallengeAction, type MfaChallengeState } from "@/lib/auth/mfa-actions";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/cn";

const initialState: MfaChallengeState = {};
const inputStyles = "mt-1.5 h-11 w-full rounded-md border border-border-strong px-3 text-body focus:border-pine focus:outline-none focus:ring-2 focus:ring-pine/30";

export function MfaChallengeForm() {
  const [state, action, pending] = useActionState(completeMfaChallengeAction, initialState);
  return (
    <form action={action} className="mt-8 space-y-5" noValidate>
      <div>
        <label htmlFor="code" className="text-label font-semibold text-ink">Authenticator or recovery code</label>
        <input id="code" name="code" required autoComplete="one-time-code" className={inputStyles} />
      </div>
      {state.error ? <p role="alert" className="rounded-md bg-danger-bg px-3 py-2 text-body-sm text-danger">{state.error}</p> : null}
      <button type="submit" disabled={pending} className={cn(buttonVariants({ size: "lg" }), "w-full")}>
        {pending ? "Verifying..." : "Verify and sign in"}
      </button>
    </form>
  );
}
