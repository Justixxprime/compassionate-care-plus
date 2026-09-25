"use client";

import { useState, useTransition } from "react";
import { changeCareRequestStatusAction } from "@/lib/care-requests-actions";
import { CARE_REQUEST_TRANSITIONS, type CareRequestAction } from "@/lib/care-request-constants";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/cn";

// The buttons on one care request row. changeCareRequestStatus re-checks
// permission on every click; a "closed" row already shows no buttons
// (see page.tsx), same idea as a task in a final state.
export function CareRequestActions({
  requestId,
  status,
}: {
  requestId: string;
  status: string;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function run(action: CareRequestAction) {
    if (action === "close" && !window.confirm("Close this request? This cannot be undone.")) {
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await changeCareRequestStatusAction(requestId, action);
      if (!result.ok) setError(result.error ?? "Something went wrong.");
    });
  }

  if (status === "closed") return null;

  const buttons: { action: CareRequestAction; primary: boolean }[] = [];
  if (status === "new") buttons.push({ action: "contact", primary: true });
  buttons.push({ action: "close", primary: false });

  return (
    <div className="flex flex-col items-start gap-2 sm:items-end">
      <div className="flex flex-wrap gap-2">
        {buttons.map(({ action, primary }) => (
          <button
            key={action}
            type="button"
            disabled={pending}
            onClick={() => run(action)}
            className={cn(buttonVariants({ size: "sm", variant: primary ? "primary" : "secondary" }))}
          >
            {CARE_REQUEST_TRANSITIONS[action].label}
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
