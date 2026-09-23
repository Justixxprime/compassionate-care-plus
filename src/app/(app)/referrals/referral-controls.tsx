"use client";

import { useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import {
  changeReferralStatusAction,
  updateReferralAction,
} from "@/lib/referrals-actions";
import {
  REFERRAL_NOTE_MAX,
  REFERRAL_TRANSITIONS,
  type ReferralAction,
} from "@/lib/referral-constants";
import { Button, buttonVariants } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/cn";
import {
  ReferralFields,
  type ReferralFieldDefaults,
} from "./referral-fields";

// The interactive pieces of one referral card. The page only draws each
// one when the signed-in person is allowed to use it (the flags come
// from listReferrals), but that is convenience: every action re-checks
// permission, reach and fields on the server.

function ErrorLine({ text }: { text: string | null }) {
  if (!text) return null;
  return (
    <p role="alert" className="max-w-md text-caption text-danger">
      {text}
    </p>
  );
}

// ---------- Start review / accept ----------

export function ReferralDecisionButtons({
  referralId,
  actions,
  matchingPatient,
}: {
  referralId: string;
  actions: ReferralAction[];
  matchingPatient: { id: string; name: string } | null;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const simple = actions.filter((a) => a === "start_review" || a === "accept");
  const withNote = actions.filter((a) => a === "decline" || a === "withdraw");

  function run(action: ReferralAction) {
    if (action === "accept") {
      const question = matchingPatient
        ? `Accept this referral and link it to the existing record for ${matchingPatient.name}?`
        : "Accept this referral and create a new patient record? This cannot be undone.";
      if (!window.confirm(question)) return;
    }
    setError(null);
    startTransition(async () => {
      const result = await changeReferralStatusAction(
        referralId,
        action,
        action === "accept"
          ? { existingPatientId: matchingPatient?.id ?? null }
          : {},
      );
      if (!result.ok) {
        setError(result.error ?? "Something went wrong.");
        return;
      }
      // Accept-and-assign, in one flow: land straight on the patient's
      // care team panel so the next step (put someone on the team) does
      // not need a second trip through the patient list to find them.
      if (action === "accept" && result.patientId) {
        router.push(`/patients/${result.patientId}`);
      }
    });
  }

  if (actions.length === 0) return null;

  return (
    <div className="flex flex-col items-start gap-3 sm:items-end">
      {simple.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {simple.map((action) => (
            <button
              key={action}
              type="button"
              disabled={pending}
              onClick={() => run(action)}
              className={cn(buttonVariants({ size: "sm" }))}
            >
              {action === "accept" && matchingPatient
                ? "Accept and link to existing patient"
                : action === "accept"
                  ? "Accept and create patient"
                  : REFERRAL_TRANSITIONS[action].label}
            </button>
          ))}
        </div>
      ) : null}
      <ErrorLine text={error} />
      {withNote.map((action) => (
        <NoteAction key={action} referralId={referralId} action={action} />
      ))}
    </div>
  );
}

// Decline and withdraw both need a written reason first.
function NoteAction({
  referralId,
  action,
}: {
  referralId: string;
  action: ReferralAction;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const label = REFERRAL_TRANSITIONS[action].label;

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const note = String(new FormData(e.currentTarget).get("note") ?? "");
    if (!window.confirm(`${label} this referral? This cannot be undone.`)) return;
    setError(null);
    startTransition(async () => {
      const result = await changeReferralStatusAction(referralId, action, {
        note,
      });
      if (!result.ok) setError(result.error ?? "Something went wrong.");
    });
  }

  return (
    <details className="w-full max-w-md rounded-md border border-border bg-white px-3 py-2">
      <summary className="cursor-pointer text-body-sm font-medium text-ink">
        {label}...
      </summary>
      <form onSubmit={onSubmit} className="mt-3 space-y-3" noValidate>
        <div>
          <Label htmlFor={`note-${action}-${referralId}`}>
            Reason (only administrative staff can see this)
          </Label>
          <textarea
            id={`note-${action}-${referralId}`}
            name="note"
            rows={3}
            required
            maxLength={REFERRAL_NOTE_MAX}
            className="w-full rounded-md border border-border-strong bg-white px-3 py-2 text-body text-ink focus-visible:outline-none"
          />
        </div>
        <ErrorLine text={error} />
        <Button type="submit" size="sm" variant="secondary" disabled={pending}>
          {pending ? "Saving..." : label}
        </Button>
      </form>
    </details>
  );
}

// ---------- Edit an open referral ----------

export function EditReferralForm({
  referralId,
  defaults,
}: {
  referralId: string;
  defaults: ReferralFieldDefaults;
}) {
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    setError(null);
    setMessage(null);
    startTransition(async () => {
      const result = await updateReferralAction(referralId, data);
      if (result.ok) setMessage("Saved.");
      else setError(result.error ?? "Something went wrong.");
    });
  }

  return (
    <details className="mt-4 rounded-md border border-border bg-sage/40 px-4 py-3">
      <summary className="cursor-pointer text-body-sm font-medium text-pine">
        Edit this referral
      </summary>
      <form onSubmit={onSubmit} className="mt-4 space-y-5" noValidate>
        <ReferralFields idPrefix={`edit-${referralId}`} defaults={defaults} />
        <ErrorLine text={error} />
        {message ? (
          <p role="status" className="text-caption text-success">
            {message}
          </p>
        ) : null}
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? "Saving..." : "Save changes"}
        </Button>
      </form>
    </details>
  );
}
