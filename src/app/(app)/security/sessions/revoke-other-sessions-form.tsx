"use client";

import { useState, useTransition, type FormEvent } from "react";
import { revokeOtherSessionsAction } from "@/lib/auth/session-controls-actions";
import { Button } from "@/components/ui/button";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";

export function RevokeOtherSessionsForm({ otherSessionCount }: { otherSessionCount: number }) {
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    setError(null);
    setMessage(null);
    startTransition(async () => {
      const result = await revokeOtherSessionsAction(new FormData(form));
      if (!result.ok) {
        setError(result.error ?? "Other sessions could not be signed out.");
        return;
      }
      form.reset();
      setMessage(result.revoked ? `${result.revoked} other ${result.revoked === 1 ? "session was" : "sessions were"} signed out.` : "There were no other active sessions to sign out.");
    });
  }

  return (
    <form onSubmit={submit} className="max-w-xl rounded-md border border-border bg-white p-5 sm:p-6" noValidate>
      <p className="text-body-sm text-slate">{otherSessionCount ? `${otherSessionCount} other active ${otherSessionCount === 1 ? "session is" : "sessions are"} currently listed.` : "No other active sessions are listed."}</p>
      <div className="mt-5">
        <Label htmlFor="session-control-password">Current password</Label>
        <PasswordInput id="session-control-password" name="currentPassword" autoComplete="current-password" required />
      </div>
      {error ? <p role="alert" className="mt-4 rounded-md bg-danger-bg px-3 py-2 text-body-sm text-danger">{error}</p> : null}
      {message ? <p role="status" className="mt-4 rounded-md bg-success-bg px-3 py-2 text-body-sm text-success">{message}</p> : null}
      <Button type="submit" variant="secondary" className="mt-5" disabled={pending || otherSessionCount === 0}>
        {pending ? "Signing out..." : "Sign out other sessions"}
      </Button>
    </form>
  );
}
