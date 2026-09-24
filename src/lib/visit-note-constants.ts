// src/lib/visit-note-constants.ts
//
// The fixed vocabulary for visit notes, in one place. Pure data - no
// database, no "server-only" - so the note form (a Client Component) and
// the server-side rules in src/lib/visit-notes.ts read the SAME numbers.
// If they ever disagreed, the server's answer would win: the browser is
// never trusted.

export const VISIT_NOTE_STATUSES = ["draft", "submitted", "reviewed"] as const;

export type VisitNoteStatus = (typeof VISIT_NOTE_STATUSES)[number];

export const VISIT_NOTE_STATUS_LABELS: Record<VisitNoteStatus, string> = {
  draft: "Draft",
  submitted: "Submitted",
  reviewed: "Reviewed",
};

// The actions someone can take on a note, and what each one does. Like
// VISIT_TRANSITIONS and PLAN_TRANSITIONS, this table IS the state
// machine: an action not listed for a note's current status cannot
// happen, no matter who asks.
//
//   draft     -> submit -> submitted  (the author, visits.document)
//   submitted -> review -> reviewed   (visits.review, and the reviewer
//                                      must NOT be the author)
//
// reviewed is final. A reviewed note is never reopened - if the visit
// needs correcting after that point, that is a new, separately recorded
// event, not a quiet edit to what was already reviewed.
export type VisitNoteAction = "submit" | "review";

export const VISIT_NOTE_TRANSITIONS: Record<
  VisitNoteAction,
  { from: VisitNoteStatus; to: VisitNoteStatus; auditAction: string; label: string }
> = {
  submit: {
    from: "draft",
    to: "submitted",
    auditAction: "visit_note_submitted",
    label: "Submit for review",
  },
  review: {
    from: "submitted",
    to: "reviewed",
    auditAction: "visit_note_reviewed",
    label: "Mark reviewed",
  },
};

export function isVisitNoteAction(value: string): value is VisitNoteAction {
  return Object.prototype.hasOwnProperty.call(VISIT_NOTE_TRANSITIONS, value);
}

// A visit note can only be started once the visit has actually begun.
// Documenting something that has not happened yet makes no sense, and a
// cancelled or missed visit has nothing to document.
export const VISIT_STATUSES_ALLOWING_NOTE = ["in_progress", "completed"] as const;

// Size limit. Keeps the database sensible and the screen readable, and
// stops someone pasting an entire chart into one field.
export const NOTE_CONTENT_MAX = 4000;

// ---------- Addenda ----------
//
// A reviewed note is never edited. When it needs correcting or
// completing, the visit's own clinician adds an ADDENDUM: a separate,
// permanent entry under the note. The original words stay exactly as they
// were reviewed. An addendum is written once (no editing, no deleting)
// and then waits for a second person to mark it reviewed:
//
//   (written)  ->  submitted  ->  review  ->  reviewed
//
// Only one addendum may wait for review at a time, and a note holds at
// most ADDENDA_MAX_PER_NOTE of them, so the trail stays readable.

export const ADDENDUM_KINDS = [
  { key: "correction", label: "Correction" },
  { key: "additional_information", label: "Additional information" },
  { key: "late_entry", label: "Late entry" },
] as const;

export type AddendumKind = (typeof ADDENDUM_KINDS)[number]["key"];

export function isAddendumKind(value: string): value is AddendumKind {
  return ADDENDUM_KINDS.some((k) => k.key === value);
}

export function addendumKindLabel(key: string): string {
  return ADDENDUM_KINDS.find((k) => k.key === key)?.label ?? key;
}

export const ADDENDUM_STATUSES = ["submitted", "reviewed"] as const;
export type AddendumStatus = (typeof ADDENDUM_STATUSES)[number];

export const ADDENDUM_STATUS_LABELS: Record<AddendumStatus, string> = {
  submitted: "Waiting for review",
  reviewed: "Reviewed",
};

export const ADDENDUM_CONTENT_MAX = 2000;
export const ADDENDA_MAX_PER_NOTE = 10;
