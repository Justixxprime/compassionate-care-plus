"use client";

import { useState, useTransition, type FormEvent } from "react";
import { createConsentAction } from "@/lib/family-consents-actions";
import {
  CONSENT_DURATIONS,
  CONSENT_SCOPES,
  FAMILY_RELATIONSHIPS,
} from "@/lib/family-constants";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

// What the person may choose from, built on the server (getConsentOptions).
// createConsent checks all of it again on the server.
export interface ConsentOptionsProp {
  patients: { patientId: string; patientName: string }[];
  people: { id: string; label: string }[];
}

const selectStyles =
  "h-11 w-full rounded-md border border-border-strong bg-white px-3 text-body text-ink focus-visible:outline-none";

export function ConsentForm({ options }: { options: ConsentOptionsProp }) {
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
      const result = await createConsentAction(data);
      if (result.ok) {
        setMessage("Permission recorded. You can withdraw it at any time below.");
        form.reset();
      } else {
        setError(result.error ?? "Something went wrong.");
      }
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5" noValidate>
      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <Label htmlFor="consent-patient">Patient</Label>
          <select id="consent-patient" name="patientId" required className={selectStyles}>
            {options.patients.map((p) => (
              <option key={p.patientId} value={p.patientId}>
                {p.patientName}
              </option>
            ))}
          </select>
        </div>
        <div>
          <Label htmlFor="consent-person">Family account</Label>
          <select id="consent-person" name="familyUserId" required className={selectStyles}>
            {options.people.length === 0 ? (
              <option value="">No family accounts exist yet</option>
            ) : (
              options.people.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))
            )}
          </select>
        </div>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <Label htmlFor="consent-relationship">How they are related</Label>
          <select id="consent-relationship" name="relationship" required className={selectStyles}>
            {FAMILY_RELATIONSHIPS.map((r) => (
              <option key={r.key} value={r.key}>
                {r.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <Label htmlFor="consent-duration">For how long</Label>
          <select id="consent-duration" name="duration" defaultValue="90_days" className={selectStyles}>
            {CONSENT_DURATIONS.map((d) => (
              <option key={d.key} value={d.key}>
                {d.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <fieldset>
        <legend className="text-body-sm font-medium text-ink">What the patient chose to share</legend>
        <div className="mt-2 space-y-3">
          {CONSENT_SCOPES.map((s) => (
            <label key={s.key} className="flex min-h-11 items-start gap-3">
              <input
                type="checkbox"
                name="scopes"
                value={s.key}
                className="mt-1 h-5 w-5 flex-none accent-pine"
              />
              <span>
                <span className="block text-body text-ink">{s.label}</span>
                <span className="block text-caption text-slate">{s.help}</span>
              </span>
            </label>
          ))}
        </div>
        <p className="mt-2 text-caption text-slate">
          Nothing else can be shared here: no visit notes, tasks, documents or messages.
        </p>
      </fieldset>

      <label className="flex min-h-11 items-start gap-3 rounded-md bg-sage px-3 py-3">
        <input type="checkbox" name="confirmed" value="yes" className="mt-1 h-5 w-5 flex-none accent-pine" />
        <span className="text-body-sm text-ink">
          The patient has given their permission for this, and a signed form is on file.
        </span>
      </label>

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

      <Button type="submit" disabled={pending || options.people.length === 0}>
        {pending ? "Recording..." : "Record permission"}
      </Button>
    </form>
  );
}
