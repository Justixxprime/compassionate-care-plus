"use client";

import { useState, useTransition, type FormEvent } from "react";
import {
  addAddendumAction,
  createVisitNoteAction,
  reviewAddendumAction,
  reviewVisitNoteAction,
  submitVisitNoteAction,
  updateVisitNoteAction,
} from "@/lib/visit-notes-actions";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge, type BadgeProps } from "@/components/ui/badge";
import {
  ADDENDUM_CONTENT_MAX,
  ADDENDUM_KINDS,
  ADDENDUM_STATUS_LABELS,
  VISIT_NOTE_STATUS_LABELS,
  addendumKindLabel,
  type AddendumStatus,
  type VisitNoteStatus,
} from "@/lib/visit-note-constants";
import type { AddendumRow, VisitNoteRow } from "@/lib/visit-notes";
import { formatOrgDate } from "@/lib/time";

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

// One correction or addition under a reviewed note, and (for a reviewer)
// the button that marks it reviewed.
function AddendumReviewButton({
  visitId,
  addendumId,
}: {
  visitId: string;
  addendumId: string;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function run() {
    if (!window.confirm("Mark this addendum as reviewed?")) return;
    setError(null);
    startTransition(async () => {
      const result = await reviewAddendumAction(visitId, addendumId);
      if (!result.ok) setError(result.error ?? "Something went wrong.");
    });
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <Button type="button" size="sm" disabled={pending} onClick={run}>
        {pending ? "Marking reviewed..." : "Mark addendum reviewed"}
      </Button>
      {error ? (
        <p role="alert" className="text-caption text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function AddendumItem({ visitId, addendum }: { visitId: string; addendum: AddendumRow }) {
  return (
    <li className="space-y-2 rounded-md border border-border bg-white p-4">
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone="info">{addendumKindLabel(addendum.kind)}</Badge>
        <Badge tone={addendum.status === "reviewed" ? "success" : "warning"}>
          {ADDENDUM_STATUS_LABELS[addendum.status as AddendumStatus] ?? addendum.status}
        </Badge>
        <span className="text-body-sm text-slate">
          by {addendum.authorName} on {formatOrgDate(addendum.createdAt)}
        </span>
        {addendum.reviewedByName ? (
          <span className="text-body-sm text-slate">reviewed by {addendum.reviewedByName}</span>
        ) : null}
      </div>
      <p className="whitespace-pre-wrap text-body-sm text-ink">{addendum.content}</p>
      {addendum.canReview ? (
        <AddendumReviewButton visitId={visitId} addendumId={addendum.id} />
      ) : null}
    </li>
  );
}

// The form for a new addendum. It is written once: there is no edit and
// no delete, so the form says so before anyone presses the button.
function AddendumForm({ visitId }: { visitId: string }) {
  const [kind, setKind] = useState<string>(ADDENDUM_KINDS[0].key);
  const [content, setContent] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (
      !window.confirm(
        "Add this addendum? It becomes part of the record and cannot be edited or removed.",
      )
    ) {
      return;
    }
    const data = new FormData();
    data.set("visitId", visitId);
    data.set("kind", kind);
    data.set("content", content);
    setError(null);
    startTransition(async () => {
      const result = await addAddendumAction(data);
      if (result.ok) {
        setContent("");
      } else {
        setError(result.error ?? "Something went wrong.");
      }
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3" noValidate>
      <div>
        <Label htmlFor={`addendum-kind-${visitId}`}>What kind of addendum</Label>
        <select
          id={`addendum-kind-${visitId}`}
          value={kind}
          onChange={(e) => setKind(e.target.value)}
          className="h-11 w-full rounded-md border border-border-strong bg-white px-3 text-body text-ink focus-visible:outline-none sm:w-72"
        >
          {ADDENDUM_KINDS.map((k) => (
            <option key={k.key} value={k.key}>
              {k.label}
            </option>
          ))}
        </select>
      </div>
      <div>
        <Label htmlFor={`addendum-${visitId}`}>What are you adding or correcting</Label>
        <textarea
          id={`addendum-${visitId}`}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          required
          maxLength={ADDENDUM_CONTENT_MAX}
          className={textareaStyles}
        />
      </div>
      {error ? (
        <p role="alert" className="rounded-md bg-danger-bg px-3 py-2 text-body-sm text-danger">
          {error}
        </p>
      ) : null}
      <Button type="submit" size="sm" variant="secondary" disabled={pending}>
        {pending ? "Adding..." : "Add addendum"}
      </Button>
    </form>
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

      {note.addenda.length > 0 || note.canAddAddendum ? (
        <div className="space-y-3 border-t border-border pt-4">
          <h3 className="text-body font-semibold text-ink">Addenda</h3>
          <p className="text-body-sm text-slate">
            The reviewed note above is never changed. Corrections and additions are added here,
            each one permanent, and each one is reviewed by someone other than its author.
          </p>
          {note.addenda.length > 0 ? (
            <ul className="space-y-3">
              {note.addenda.map((a) => (
                <AddendumItem key={a.id} visitId={visitId} addendum={a} />
              ))}
            </ul>
          ) : null}
          {note.canAddAddendum ? <AddendumForm visitId={visitId} /> : null}
        </div>
      ) : null}
    </div>
  );
}
