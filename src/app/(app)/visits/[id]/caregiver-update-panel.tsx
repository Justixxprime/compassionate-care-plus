"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { reviewCaregiverVisitUpdateAction } from "@/lib/caregiver-visit-updates-actions";
import type { CaregiverVisitUpdateRow } from "@/lib/caregiver-visit-updates";

export function CaregiverUpdatePanel({ visitId, update }: { visitId: string; update: CaregiverVisitUpdateRow | null }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  if (!update) return <p className="text-body-sm text-slate">No caregiver update has been submitted for this visit.</p>;

  function review() {
    if (!window.confirm("Mark this caregiver update as reviewed?")) return;
    setError(null);
    startTransition(async () => {
      const result = await reviewCaregiverVisitUpdateAction(visitId);
      if (!result.ok) setError(result.error ?? "Something went wrong.");
    });
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone={update.status === "reviewed" ? "success" : update.status === "submitted" ? "warning" : "neutral"}>
          {update.status === "submitted" ? "Waiting for review" : update.status[0].toUpperCase() + update.status.slice(1)}
        </Badge>
        <span className="text-body-sm text-slate">by {update.authorName}</span>
        {update.reviewedByName ? <span className="text-body-sm text-slate">reviewed by {update.reviewedByName}</span> : null}
      </div>
      <p className="whitespace-pre-wrap rounded-md border border-border bg-sage p-4 text-body-sm text-ink">{update.content}</p>
      {update.canReview ? (
        <Button type="button" size="sm" disabled={pending} onClick={review}>
          {pending ? "Marking reviewed..." : "Mark reviewed"}
        </Button>
      ) : null}
      {error ? <p role="alert" className="text-caption text-danger">{error}</p> : null}
    </div>
  );
}
