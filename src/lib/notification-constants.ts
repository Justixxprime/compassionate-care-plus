// src/lib/notification-constants.ts
//
// What each kind of notification says, and where it points. Pure data -
// no database, no "server-only" - so the notifications screen and the
// test script read the SAME wording.
//
// A notification NEVER carries a patient's name, a task's title or any
// clinical words. It says only that something happened, in general terms,
// and points at the record. The page behind the link checks access again,
// so a notification can never show someone something their own screens
// would refuse. (This follows PHASE_0_ARCHITECTURE.md section 9: a message
// says only "you have something waiting, please sign in".)

export const NOTIFICATION_KINDS = [
  "task_assigned",
  "task_completed",
  "task_cancelled",
  "note_reviewed",
  "addendum_reviewed",
  "care_request_received",
] as const;

export type NotificationKind = (typeof NOTIFICATION_KINDS)[number];

export function isNotificationKind(value: string): value is NotificationKind {
  return (NOTIFICATION_KINDS as readonly string[]).includes(value);
}

const WORDS: Record<NotificationKind, string> = {
  task_assigned: "A task was given to you.",
  task_completed: "A task you asked for was finished.",
  task_cancelled: "A task given to you was cancelled.",
  note_reviewed: "Your visit note was reviewed.",
  addendum_reviewed: "Your addendum to a visit note was reviewed.",
  care_request_received: "Someone asked to request care on the public site.",
};

// The plain sentence and the link for one notification. An unknown kind
// (say, one written by a newer version of the app) still gets a safe,
// generic answer instead of breaking the screen.
export function describeNotification(
  kind: string,
  resourceId: string,
): { text: string; href: string } {
  if (!isNotificationKind(kind)) {
    return { text: "You have a new notification.", href: "/dashboard" };
  }
  const href =
    kind === "note_reviewed" || kind === "addendum_reviewed"
      ? `/visits/${encodeURIComponent(resourceId)}`
      : kind === "care_request_received"
        ? "/care-requests"
        : "/tasks";
  return { text: WORDS[kind], href };
}

export const NOTIFICATION_LIST_LIMIT = 50;
