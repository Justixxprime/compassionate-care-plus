"use client";

import { useState, useTransition } from "react";
import { endCareTeamAssignmentAction } from "@/lib/care-team-actions";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/cn";

export function EndAssignmentButton({
  assignmentId,
  patientId,
  personName,
}: {
  assignmentId: string;
  patientId: string;
  personName: string;
}) {
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function run() {
    if (!window.confirm(`End ${personName}'s place on this care team?`)) return;
    setError(null);
    setNote(null);
    startTransition(async () => {
      const result = await endCareTeamAssignmentAction(assignmentId, patientId);
      if (!result.ok) {
        setError(result.error ?? "Something went wrong.");
        return;
      }
      // Visits already on the calendar for this person are NOT
      // cancelled - that is a decision for a human, so we just say how
      // many there are, exactly as src/lib/care-team.ts documents.
      if (result.futureVisitsToReassign && result.futureVisitsToReassign > 0) {
        setNote(
          `Ended. ${result.futureVisitsToReassign} upcoming ${result.futureVisitsToReassign === 1 ? "visit is" : "visits are"} still scheduled with them - reassign or cancel those separately.`,
        );
      }
    });
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <button
        type="button"
        disabled={pending}
        onClick={run}
        className={cn(buttonVariants({ size: "sm", variant: "secondary" }))}
      >
        {pending ? "Ending..." : "End"}
      </button>
      {error ? (
        <p role="alert" className="max-w-xs text-caption text-danger">
          {error}
        </p>
      ) : null}
      {note ? (
        <p role="status" className="max-w-xs text-caption text-warning">
          {note}
        </p>
      ) : null}
    </div>
  );
}
