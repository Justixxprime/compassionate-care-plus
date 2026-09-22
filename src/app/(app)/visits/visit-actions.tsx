"use client";

import { useState, useTransition } from "react";
import { changeVisitStatusAction } from "@/lib/visits-actions";
import {
  VISIT_TRANSITIONS,
  actionsAvailableFor,
  type VisitAction,
} from "@/lib/visit-constants";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/cn";

// The buttons on one visit row: check in, check out, cancel, mark missed.
// Which buttons appear comes from the visit's current status (see
// VISIT_TRANSITIONS), and the page only renders this at all when the
// signed-in person is allowed to change the visit. Both are convenience:
// changeVisitStatus on the server re-checks everything on every click.

const CONFIRM_FIRST: VisitAction[] = ["cancel", "mark_missed"];

export function VisitActions({
  visitId,
  status,
}: {
  visitId: string;
  status: string;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const available = actionsAvailableFor(status);
  if (available.length === 0) return null;

  function run(action: VisitAction) {
    if (
      CONFIRM_FIRST.includes(action) &&
      !window.confirm(`${VISIT_TRANSITIONS[action].label}? This cannot be undone.`)
    ) {
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await changeVisitStatusAction(visitId, action);
      if (!result.ok) setError(result.error ?? "Something went wrong.");
    });
  }

  return (
    <div className="flex flex-col items-start gap-2 sm:items-end">
      <div className="flex flex-wrap gap-2">
        {available.map((action) => (
          <button
            key={action}
            type="button"
            disabled={pending}
            onClick={() => run(action)}
            className={cn(
              buttonVariants({
                size: "sm",
                variant:
                  action === "check_in" || action === "check_out"
                    ? "primary"
                    : "secondary",
              }),
            )}
          >
            {VISIT_TRANSITIONS[action].label}
          </button>
        ))}
      </div>
      {error ? (
        <p role="alert" className="max-w-xs text-caption text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}
