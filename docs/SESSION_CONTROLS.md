# Active session controls

Every sign-in creates a server-side session that expires after seven days. The
browser receives only an httpOnly session identifier; sessions can therefore
be revoked immediately instead of remaining valid until a JWT expires.

## What a signed-in person can do

Open **Active sessions** from the account area. The page shows only their own
live sessions, with creation and expiry times. It intentionally does not
collect or display IP address, location, browser fingerprint, or device name.

**Sign out other sessions** requires the current password. It preserves the
session being used, removes every other live session belonging to that same
account, and records the event in the audit log.

## Other safety controls

- At most five live sessions can exist per account. A new one retires the
  oldest active session.
- Password reset revokes all sessions and unfinished MFA checkpoints.
- A staff MFA reset performed by an administrator also revokes the target
  staff member’s sessions.
- Authorization is checked from the database on every protected request; a
  deleted session immediately stops granting access.
