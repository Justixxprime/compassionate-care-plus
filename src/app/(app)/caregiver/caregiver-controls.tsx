"use client";

import { useState, useTransition, type FormEvent } from "react";
import {
  caregiverVisitActionAction,
  saveCaregiverVisitUpdateAction,
  submitCaregiverVisitUpdateAction,
} from "@/lib/caregiver-actions";
import { changeTaskStatusAction } from "@/lib/tasks-actions";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/cn";

// The big buttons of the caregiver portal. They are drawn for a thumb on a
// phone: full width on a small screen, tall, one job each. Which buttons
// appear was decided on the server from what this person may do right now,
// and the server re-checks permission, reach and ownership on every tap.

const BIG = "h-14 w-full text-lg sm:w-auto sm:min-w-44";

function ErrorLine({ message }: { message: string | null }) {
  return message ? (
    <p role="alert" className="text-body-sm text-danger">
      {message}
    </p>
  ) : null;
}

export function VisitButton({
  visitId,
  action,
  label,
}: {
  visitId: string;
  action: "check_in" | "check_out";
  label: string;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function run() {
    setError(null);
    startTransition(async () => {
      const result = await caregiverVisitActionAction(visitId, action);
      if (!result.ok) setError(result.error ?? "Something went wrong.");
    });
  }

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        disabled={pending}
        onClick={run}
        className={cn(buttonVariants({ size: "lg", variant: "primary" }), BIG)}
      >
        {pending ? "Saving..." : label}
      </button>
      <ErrorLine message={error} />
    </div>
  );
}

export function TaskDoneButton({ taskId }: { taskId: string }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function run() {
    setError(null);
    startTransition(async () => {
      const result = await changeTaskStatusAction(taskId, "complete");
      if (!result.ok) setError(result.error ?? "Something went wrong.");
    });
  }

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        disabled={pending}
        onClick={run}
        className={cn(buttonVariants({ size: "lg", variant: "secondary" }), BIG)}
      >
        {pending ? "Saving..." : "Mark done"}
      </button>
      <ErrorLine message={error} />
    </div>
  );
}

export function CaregiverVisitUpdateForm({
  visitId,
  initialContent,
  status,
}: {
  visitId: string;
  initialContent: string;
  status: string | null;
}) {
  const [content, setContent] = useState(initialContent);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const locked = status !== null && status !== "draft";

  function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData();
    data.set("visitId", visitId);
    data.set("content", content);
    setError(null);
    startTransition(async () => {
      const result = await saveCaregiverVisitUpdateAction(data);
      if (!result.ok) setError(result.error ?? "Something went wrong.");
    });
  }

  function submit() {
    if (!window.confirm("Submit this update for review? It cannot be changed afterwards.")) return;
    setError(null);
    startTransition(async () => {
      const result = await submitCaregiverVisitUpdateAction(visitId);
      if (!result.ok) setError(result.error ?? "Something went wrong.");
    });
  }

  if (locked) {
    return <p className="whitespace-pre-wrap text-body-sm text-ink">{initialContent}</p>;
  }
  return (
    <form onSubmit={save} className="mt-4 space-y-3" noValidate>
      <label className="block text-body-sm font-medium text-ink" htmlFor={`caregiver-update-${visitId}`}>
        Brief factual visit update
      </label>
      <textarea
        id={`caregiver-update-${visitId}`}
        value={content}
        onChange={(e) => setContent(e.target.value)}
        maxLength={1000}
        required
        className="min-h-28 w-full rounded-md border border-border-strong bg-white px-3 py-2 text-body text-ink focus-visible:outline-none"
      />
      <p className="text-caption text-slate">Do not write a clinical note. Save a draft while the visit is active, then submit it for staff review.</p>
      <div className="flex flex-wrap gap-2">
        <button type="submit" disabled={pending} className={buttonVariants({ size: "sm", variant: "secondary" })}>
          {pending ? "Saving..." : "Save draft"}
        </button>
        {status === "draft" ? (
          <button type="button" disabled={pending} onClick={submit} className={buttonVariants({ size: "sm", variant: "primary" })}>
            Submit for review
          </button>
        ) : null}
      </div>
      <ErrorLine message={error} />
    </form>
  );
}
