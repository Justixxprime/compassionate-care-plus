"use client";

import { useState, useTransition, type FormEvent } from "react";
import { resetStaffMfaAction } from "@/lib/staff-mfa-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface RecoverableStaffMember {
  id: string;
  name: string;
  email: string;
  mfaStatus: "not_applicable" | "off" | "pending" | "active";
}

export function ResetStaffMfaForm({ staff }: { staff: RecoverableStaffMember[] }) {
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    setError(null);
    setMessage(null);
    startTransition(async () => {
      const result = await resetStaffMfaAction(new FormData(form));
      if (!result.ok) {
        setError(result.error ?? "MFA recovery could not be completed.");
        return;
      }
      form.reset();
      setMessage("MFA was reset and the staff member was signed out everywhere. Give them instructions to sign in and enroll again.");
    });
  }

  if (staff.length === 0) return <p className="text-body-sm text-slate">There is no other staff account available for MFA recovery.</p>;

  return (
    <form onSubmit={submit} className="max-w-xl space-y-5" noValidate>
      <div>
        <Label htmlFor="mfa-target">Staff member</Label>
        <select id="mfa-target" name="targetUserId" required className="mt-1.5 h-11 w-full rounded-md border border-border-strong bg-white px-3 text-body text-ink focus-visible:outline-none">
          {staff.map((person) => <option key={person.id} value={person.id}>{person.name} — {person.email}</option>)}
        </select>
      </div>
      <div>
        <Label htmlFor="mfa-recovery-password">Your current password</Label>
        <Input id="mfa-recovery-password" name="currentPassword" type="password" autoComplete="current-password" required />
      </div>
      <p className="rounded-md bg-warning-bg px-3 py-2 text-body-sm text-warning">This action cannot be undone. It does not show or recover anyone’s old authenticator secret or recovery codes.</p>
      {error ? <p role="alert" className="rounded-md bg-danger-bg px-3 py-2 text-body-sm text-danger">{error}</p> : null}
      {message ? <p role="status" className="rounded-md bg-success-bg px-3 py-2 text-body-sm text-success">{message}</p> : null}
      <Button type="submit" variant="secondary" disabled={pending}>{pending ? "Resetting..." : "Reset staff MFA"}</Button>
    </form>
  );
}
