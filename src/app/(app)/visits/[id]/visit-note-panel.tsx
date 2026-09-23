"use client";

import { useState, useTransition, type FormEvent } from "react";
import {
  createVisitNoteAction,
  reviewVisitNoteAction,
  submitVisitNoteAction,
  updateVisitNoteAction,
} from "@/lib/visit-notes-actions";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge, type BadgeProps } from "@/components/ui/badge";
import {
  VISIT_NOTE_STATUS_LABELS,
  type VisitNoteStatus,
} from "@/lib/visit-note-constants";
import type { VisitNoteRow } from "@/lib/visit-notes";

const textareaStyles =
  "w-full min-h-40 rounded-md border border-border-strong bg-white px-3 py-2 " +
  "text-body text-ink focus-visible:outline-none";

const STATUS_TONE: Record<VisitNoteStatus, NonNullable<BadgeProps["tone"]>> = {
  draft: "neutral",
  submitted: "warning",
  reviewed: "success",
};

function statusLabel(status: string) {
  return VISIT_NOTE_STATUS_LABELS[status as VisitNoteStatus] ?? status;
}

// A new draft, or editing the existing one. Same form either way - the
// server tells us which action to call.
function NoteForm({
  visitId,
  initialContent,
  isNew,
}: {
  visitId: string;
  initialContent: string;
  isNew: boolean;
}) {
  const [content, setContent] = useState(initialContent);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData();
    data.set("visitId", visitId);
    data.set("content", content);
    setError(null);

    startTransition(async () => {
      const action = isNew ? createVisitNoteAction : updateVisitNoteAction;
      const result = await action(data);
      if (!result.ok) setError(result.error ?? "Something went wrong.");
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3" noValidate>
      <div>
        <Label htmlFor={`note-${visitId}`}>What happened at this visit</Label>
        <textarea
          id={`note-${visitId}`}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          required
          className={textareaStyles}
        />
      </div>
      {error ? (
        <p role="alert" className="rounded-md bg-danger-bg px-3 py-2 text-body-sm text-danger">
          {error}
        </p>
      ) : null}
      <Button type="submit" size="sm" disabled={pending}>
        {pending ? "Saving..." : isNew ? "Save draft" : "Save changes"}
      </Button>
    </form>
  );
}

function SubmitButton({ visitId }: { visitId: string }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function run() {
    if (!window.confirm("Submit this note for review? It will be locked once submitted.")) {
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await submitVisitNoteAction(visitId);
      if (!result.ok) setError(result.error ?? "Something went wrong.");
    });
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <Button type="button" size="sm" variant="secondary" disabled={pending} onClick={run}>
        {pending ? "Submitting..." : "Submit for review"}
      </Button>
      {error ? (
        <p role="alert" className="text-caption text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function ReviewButton({ visitId }: { visitId: string }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function run() {
    if (!window.confirm("Mark this note as reviewed?")) return;
    setError(null);
    startTransition(async () => {
      const result = await reviewVisitNoteAction(visitId);
      if (!result.ok) setError(result.error ?? "Something went wrong.");
    });
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <Button type="button" size="sm" disabled={pending} onClick={run}>
        {pending ? "Marking reviewed..." : "Mark reviewed"}
      </Button>
      {error ? (
        <p role="alert" className="text-caption text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function VisitNotePanel({
  visitId,
  note,
  canWrite,
}: {
  visitId: string;
  note: VisitNoteRow | null;
  canWrite: boolean;
}) {
  if (!note) {
    if (!canWrite) {
      return <p className="text-body-sm text-slate">No note has been written for this visit yet.</p>;
    }
    return <NoteForm visitId={visitId} initialContent="" isNew />;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone={STATUS_TONE[note.status as VisitNoteStatus] ?? "neutral"}>
          {statusLabel(note.status)}
        </Badge>
        <span className="text-body-sm text-slate">by {note.authorName}</span>
        {note.reviewedByName ? (
          <span className="text-body-sm text-slate">reviewed by {note.reviewedByName}</span>
        ) : null}
      </div>

      {note.canEdit ? (
        <NoteForm visitId={visitId} initialContent={note.content} isNew={false} />
      ) : (
        <p className="whitespace-pre-wrap rounded-md border border-border bg-sage p-4 text-body-sm text-ink">
          {note.content}
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        {note.canSubmit ? <SubmitButton visitId={visitId} /> : null}
        {note.canReview ? <ReviewButton visitId={visitId} /> : null}
      </div>
    </div>
  );
}
