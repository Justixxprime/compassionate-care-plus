"use client";

import { useState, useTransition, type FormEvent } from "react";
import { createReferralAction } from "@/lib/referrals-actions";
import { Button } from "@/components/ui/button";
import {
  EMPTY_REFERRAL_DEFAULTS,
  ReferralFields,
} from "./referral-fields";

// Shown only to someone who can record referrals (canRecordReferrals).
// That is convenience: createReferral checks permission and reach again
// on the server, whatever this form sends.
export function CreateReferralForm() {
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // Handled in onSubmit rather than as a form action so that a failed
  // attempt keeps everything the person typed.
  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const data = new FormData(form);
    setError(null);
    setMessage(null);

    startTransition(async () => {
      const result = await createReferralAction(data);
      if (result.ok) {
        setMessage("Referral recorded. It is in the list below as Received.");
        form.reset();
      } else {
        setError(result.error ?? "Something went wrong.");
      }
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5" noValidate>
      <ReferralFields idPrefix="new-referral" defaults={EMPTY_REFERRAL_DEFAULTS} />

      {error ? (
        <p
          role="alert"
          className="rounded-md bg-danger-bg px-3 py-2 text-body-sm text-danger"
        >
          {error}
        </p>
      ) : null}
      {message ? (
        <p
          role="status"
          className="rounded-md bg-success-bg px-3 py-2 text-body-sm text-success"
        >
          {message}
        </p>
      ) : null}

      <Button type="submit" disabled={pending}>
        {pending ? "Saving..." : "Record referral"}
      </Button>
    </form>
  );
}
