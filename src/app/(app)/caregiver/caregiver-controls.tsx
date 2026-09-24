"use client";

import { useState, useTransition } from "react";
import { caregiverVisitActionAction } from "@/lib/caregiver-actions";
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
