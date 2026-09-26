# NOTIFICATIONS.md

**Added:** 23 September 2026 (E4 round 2)

## What a notification is, in plain words

A short notice that something happened for you. It appears as a number on a
bell next to the app's name, and as a list on the page `/notifications`.
It never says who the patient is, and it never repeats a task title or any
clinical words. It only says that something happened, then links to the
page where you can see the details, if you have access.

## Who gets one, and when

| Something happens | Who is told | Sentence |
|---|---|---|
| A task is given to someone else | The person responsible | "A task was given to you." |
| A task is finished by someone else | The person who asked for it | "A task you asked for was finished." |
| A task is cancelled by someone else | The person responsible | "A task given to you was cancelled." |
| A visit note is reviewed | The note's author | "Your visit note was reviewed." |
| An addendum is reviewed | The addendum's author | "Your addendum to a visit note was reviewed." |
| A secure message arrives | A patient or message-enabled care-team member | "You have a new secure message." |

You are never told about something you did yourself.

## The rules

1. **Ownership.** A notification belongs to one person. Only that person
   sees it or marks it read. Someone else's notification and one that does
   not exist get the same plain words, and the attempt is written to the
   audit log as denied.
2. **No content.** The table holds a kind and a record id, never a name, a
   title or a clinical word. The wording lives in
   `src/lib/notification-constants.ts`, which the screen and the test share.
3. **Links never open doors.** The page behind a link checks permission and
   reach again.
4. **Same organization only.** A notification for a person in another
   organization is never written. An unknown kind is never written.
5. **Best effort.** Writing a notification never makes a real task or a real
   review fail. A failure is printed to the server console.
6. **No permission needed to read your own.** Nothing in a notification needs
   protecting, so the page only asks who you are (`requireUser()`). There is
   no menu item (the menu stays permission-driven); the bell is the way in.
7. **Long lists are cut.** The newest 50 are listed. The bell counts all
   unread ones.
8. **Useful delivery only.** A secure-message notification is sent only to a
   person who currently has `messages.read` and can open that conversation.
   It never contains the patient name or message text.

## Files

- `prisma/schema.prisma`: the `Notification` model (table `notifications`).
- `src/lib/notification-constants.ts`, `src/lib/notifications.ts`,
  `src/lib/notifications-actions.ts`.
- `src/app/(app)/notifications/page.tsx`, `notification-buttons.tsx`.
- `src/components/app/app-shell.tsx`: the bell (sidebar and phone top bar).
- `src/app/(app)/layout.tsx`: passes only the unread count to the shell.
- Hooks: `src/lib/tasks.ts` (created, finished, cancelled) and
  `src/lib/visit-notes.ts` (note reviewed, addendum reviewed).
- `scripts/verify-notifications.ts`: `npm run verify:notifications`, 44 checks.

## Not built yet

Email or SMS delivery, notices for reviewers when something is waiting for
them, per-person preferences, deleting or archiving old notices.
