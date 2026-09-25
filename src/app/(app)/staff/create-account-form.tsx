"use client";

import { useState, useTransition, type FormEvent } from "react";
import { createAccountAction } from "@/lib/accounts-actions";
import {
  ACCOUNT_TYPES,
  MIN_PASSWORD_LENGTH,
  STAFF_ROLE_OPTIONS,
  type AccountTypeKey,
} from "@/lib/account-constants";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export interface CreateAccountOptionsProp {
  unlinkedPatients: { patientId: string; patientName: string }[];
}

const selectStyles =
  "h-11 w-full rounded-md border border-border-strong bg-white px-3 text-body text-ink focus-visible:outline-none";

export function CreateAccountForm({ options }: { options: CreateAccountOptionsProp }) {
  const [accountType, setAccountType] = useState<AccountTypeKey>("STAFF");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const data = new FormData(form);
    setError(null);
    setMessage(null);

    startTransition(async () => {
      const result = await createAccountAction(data);
      if (result.ok) {
        setMessage("Account created. Tell the person their e-mail and the password directly.");
        form.reset();
        setAccountType("STAFF");
      } else {
        setError(result.error ?? "Something went wrong.");
      }
    });
  }

  const needsPatient = accountType === "PATIENT";
  const noPatientsLeft = needsPatient && options.unlinkedPatients.length === 0;

  return (
    <form onSubmit={onSubmit} className="space-y-5" noValidate>
      <div>
        <Label htmlFor="account-type">Kind of account</Label>
        <select
          id="account-type"
          name="accountType"
          required
          value={accountType}
          onChange={(e) => setAccountType(e.target.value as AccountTypeKey)}
          className={selectStyles}
        >
          {ACCOUNT_TYPES.map((t) => (
            <option key={t.key} value={t.key}>
              {t.label}
            </option>
          ))}
        </select>
      </div>

      {accountType === "STAFF" ? (
        <div>
          <Label htmlFor="account-role">Role</Label>
          <select id="account-role" name="staffRoleKey" required className={selectStyles}>
            {STAFF_ROLE_OPTIONS.map((r) => (
              <option key={r.key} value={r.key}>
                {r.label}
              </option>
            ))}
          </select>
        </div>
      ) : null}

      {accountType === "PATIENT" ? (
        <div>
          <Label htmlFor="account-patient">Patient</Label>
          <select
            id="account-patient"
            name="patientId"
            required
            disabled={noPatientsLeft}
            className={selectStyles}
          >
            {noPatientsLeft ? (
              <option value="">Every active patient already has an account</option>
            ) : (
              options.unlinkedPatients.map((p) => (
                <option key={p.patientId} value={p.patientId}>
                  {p.patientName}
                </option>
              ))
            )}
          </select>
          <p className="mt-1 text-caption text-slate">
            Only patients being looked after now, with no account yet.
          </p>
        </div>
      ) : null}

      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <Label htmlFor="account-name">Full name</Label>
          <Input id="account-name" name="name" type="text" required autoComplete="off" />
        </div>
        <div>
          <Label htmlFor="account-email">E-mail</Label>
          <Input id="account-email" name="email" type="email" required autoComplete="off" />
        </div>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <Label htmlFor="account-password">Temporary password</Label>
          <Input
            id="account-password"
            name="password"
            type="password"
            required
            minLength={MIN_PASSWORD_LENGTH}
            autoComplete="new-password"
          />
        </div>
        <div>
          <Label htmlFor="account-confirm">Confirm password</Label>
          <Input
            id="account-confirm"
            name="confirmPassword"
            type="password"
            required
            minLength={MIN_PASSWORD_LENGTH}
            autoComplete="new-password"
          />
        </div>
      </div>
      <p className="text-caption text-slate">
        At least {MIN_PASSWORD_LENGTH} characters. There is no e-mail service set up yet, so
        nothing is sent - tell the person their e-mail and this password directly.
      </p>

      {error ? (
        <p role="alert" className="rounded-md bg-danger-bg px-3 py-2 text-body-sm text-danger">
          {error}
        </p>
      ) : null}
      {message ? (
        <p role="status" className="rounded-md bg-success-bg px-3 py-2 text-body-sm text-success">
          {message}
        </p>
      ) : null}

      <Button type="submit" disabled={pending || noPatientsLeft}>
        {pending ? "Creating..." : "Create account"}
      </Button>
    </form>
  );
}
