# Secure messaging decision

**Status:** Built. The secure-message verification script is ready to run against
a local PostgreSQL database.

## Decision

Cheliv will use one secure conversation per patient. A patient can open only
their own conversation. Staff can open it only when they have `messages.read`
and currently reach an active or on-hold patient. Sending additionally requires
`messages.send`. Discharging a patient closes their conversation to both the
patient and staff. No message text appears in an audit entry, notification,
URL, or e-mail.

Family accounts are excluded for now. A family consent for visits, the care
team, or a care plan is not permission to read a conversation. Messages need a
separate consent scope and patient choice before they are ever shared.

## Why this is the safest useful first version

It gives a patient and their real care team a direct, understandable place to
communicate without creating a broad inbox where a staff member could browse
patients they no longer serve. The database enforces one thread for one patient
and every request still proves permission, organization, patient status, and
relationship. A care-team member who lacks `messages.read` is not notified,
because a bell link must never lead to a screen that the recipient cannot open.

## Audit and verification

Sending records `secure_message_sent` against the message id. It does not hold
the message body, patient name, or thread URL. A denied attempt is recorded as
`access_denied` against the message thread, with the same vague response for a
missing, discharged, out-of-reach, or other-organization record.

Run the following after seeding a local database:

```powershell
npm run verify:messages
```

The script creates and removes a temporary patient, account, care-team rows,
conversation, notices, and audit entries. It proves patient ownership, staff
permission and reach, read state, generic notices, caregiver exclusion, and
the immediate close after discharge.
