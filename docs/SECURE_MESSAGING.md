# Secure messaging decision

**Status:** Accepted for the next build round.

## Decision

Cheliv will use one secure conversation per patient. A patient can open only
their own conversation. Staff can open it only when they have `messages.read`
and currently reach that patient. Sending additionally requires
`messages.send`. No message text appears in an audit entry, notification, URL,
or e-mail.

Family accounts are excluded for now. A family consent for visits, the care
team, or a care plan is not permission to read a conversation. Messages need a
separate consent scope and patient choice before they are ever shared.

## Why this is the safest useful first version

It gives a patient and their real care team a direct, understandable place to
communicate without creating a broad inbox where a staff member could browse
patients they no longer serve. The database enforces one thread for one patient
and every request will still prove permission, organization, and relationship.

## Migration

Run `npx prisma migrate dev --name add_secure_messages` locally. No migration
SQL is included in this project.
