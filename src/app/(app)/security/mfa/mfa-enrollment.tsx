"use client";

import { useActionState } from "react";
import {
  beginMfaEnrollmentAction,
  confirmMfaEnrollmentAction,
  type MfaConfirmState,
  type MfaStartState,
} from "@/lib/auth/mfa-actions";
import { buttonVariants } from "@/components/ui/button";
import { PasswordInput } from "@/components/ui/password-input";
import { cn } from "@/lib/cn";

const inputStyles = "mt-1.5 h-11 w-full rounded-md border border-border-strong px-3 text-body focus:border-pine focus:outline-none focus:ring-2 focus:ring-pine/30";
const startState: MfaStartState = { ok: false, error: "" };
const confirmState: MfaConfirmState = { ok: false, error: "" };

export function MfaEnrollment({ status }: { status: "off" | "pending" | "active" }) {
  const [started, startAction, starting] = useActionState(beginMfaEnrollmentAction, startState);
  const [confirmed, confirmAction, confirming] = useActionState(confirmMfaEnrollmentAction, confirmState);
  const manualKey = started.ok ? started.manualKey : null;
  const recoveryCodes = confirmed.ok ? confirmed.recoveryCodes : null;

  if (recoveryCodes) {
    return (
      <div className="rounded-md border border-marigold/50 bg-white p-5 sm:p-6">
        <p className="font-semibold text-ink">Authenticator app is active.</p>
        <p className="mt-2 text-body-sm text-slate">Save these ten recovery codes in a password manager now. Each works once; they cannot be shown again.</p>
        <ul className="mt-4 grid gap-2 rounded-md bg-sage p-4 font-mono text-body-sm text-ink sm:grid-cols-2" aria-label="One-time recovery codes">
          {recoveryCodes.map((code) => <li key={code}>{code}</li>)}
        </ul>
      </div>
    );
  }

  if (manualKey) {
    return (
      <div className="max-w-xl rounded-md border border-border bg-white p-5 sm:p-6">
        <p className="font-semibold text-ink">Step 2 of 2: confirm your authenticator</p>
        <ol className="mt-3 list-decimal space-y-2 pl-5 text-body-sm text-slate">
          <li>Open your authenticator app and choose to add an account manually.</li>
          <li>Use account name <strong className="text-ink">Cheliv staff</strong>, choose a time-based code, and enter this key:</li>
        </ol>
        <p className="mt-3 break-all rounded-md bg-sage px-3 py-3 font-mono text-body-sm font-semibold tracking-wide text-ink">{manualKey}</p>
        <form action={confirmAction} className="mt-5 space-y-4" noValidate>
          <div>
            <label htmlFor="code" className="text-label font-semibold text-ink">Newest 6-digit code</label>
            <input id="code" name="code" inputMode="numeric" autoComplete="one-time-code" required maxLength={6} className={inputStyles} />
          </div>
          {!confirmed.ok && confirmed.error ? <p role="alert" className="rounded-md bg-danger-bg px-3 py-2 text-body-sm text-danger">{confirmed.error}</p> : null}
          <button type="submit" disabled={confirming} className={cn(buttonVariants({ size: "lg" }), "w-full sm:w-auto")}>
            {confirming ? "Confirming..." : "Confirm and show recovery codes"}
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="max-w-xl rounded-md border border-border bg-white p-5 sm:p-6">
      {status === "active" ? <p className="mb-4 rounded-md bg-success-bg px-3 py-2 text-body-sm text-ink">An authenticator app is already active for this account. Starting again replaces it after confirmation.</p> : null}
      <p className="text-body-sm text-slate">To begin, confirm your current password. You will then receive a private setup key for your authenticator app.</p>
      <form action={startAction} className="mt-5 space-y-4" noValidate>
        <div>
          <label htmlFor="password" className="text-label font-semibold text-ink">Current password</label>
          <PasswordInput id="password" name="password" autoComplete="current-password" required className={inputStyles.replace("mt-1.5 ", "")} />
        </div>
        {!started.ok && started.error ? <p role="alert" className="rounded-md bg-danger-bg px-3 py-2 text-body-sm text-danger">{started.error}</p> : null}
        <button type="submit" disabled={starting} className={cn(buttonVariants({ size: "lg" }), "w-full sm:w-auto")}>
          {starting ? "Starting..." : "Set up authenticator app"}
        </button>
      </form>
    </div>
  );
}
