"use client";

import { useState, useTransition, type FormEvent } from "react";
import { createCarePlanAction } from "@/lib/care-plans-actions";
import { SUMMARY_MAX, TITLE_MAX } from "@/lib/care-plan-constants";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

// One patient the form may start a plan for. Built on the server
// (getPlanCreateOptions) from what THIS signed-in person is allowed to
// write, so the browser is never handed patients it has no business with.
export interface PlanCreateOptionProp {
  patientId: string;
  patientName: string;
}

const selectStyles =
  "h-11 w-full rounded-md border border-border-strong bg-white px-3 text-body text-ink focus-visible:outline-none";
const textareaStyles =
  "w-full rounded-md border border-border-strong bg-white px-3 py-2 text-body text-ink focus-visible:outline-none";

export function CreatePlanForm({
  options,
}: {
  options: PlanCreateOptionProp[];
}) {
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // Handled in onSubmit rather than as a form action so that a failed
  // attempt keeps everything the person typed (React clears a form after
  // an action finishes, even a failed one).
  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const data = new FormData(form);
    setError(null);
    setMessage(null);

    startTransition(async () => {
      const result = await createCarePlanAction(data);
      if (result.ok) {
        setMessage("Draft created. Add goals to it below.");
        form.reset();
      } else {
        setError(result.error ?? "Something went wrong.");
      }
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5" noValidate>
      <div>
        <Label htmlFor="new-plan-patient">Patient</Label>
        <select
          id="new-plan-patient"
          name="patientId"
          required
          className={selectStyles}
        >
          {options.map((o) => (
            <option key={o.patientId} value={o.patientId}>
              {o.patientName}
            </option>
          ))}
        </select>
      </div>

      <div>
        <Label htmlFor="new-plan-title">Title</Label>
        <Input
          id="new-plan-title"
          name="title"
          required
          maxLength={TITLE_MAX}
          placeholder="For example: Recovery at home after a hospital stay"
        />
      </div>

      <div>
        <Label htmlFor="new-plan-summary">Summary</Label>
        <textarea
          id="new-plan-summary"
          name="summary"
          required
          rows={4}
          maxLength={SUMMARY_MAX}
          className={textareaStyles}
        />
      </div>

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
        {pending ? "Saving..." : "Start draft"}
      </Button>
    </form>
  );
}
