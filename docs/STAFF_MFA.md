# Staff authenticator-app MFA

This application supports an optional second sign-in step for staff accounts.
It uses standard time-based codes from an authenticator app, with ten one-time
recovery codes. It does not send a code by email and does not expose patient
data during the sign-in check.

## Before anyone enrolls

In Vercel, open this project's **Settings**, then **Environment Variables**.
Create this private variable for **Production**, **Preview**, and
**Development**:

| Name | What to enter |
| --- | --- |
| `MFA_ENCRYPTION_KEY` | A new random secret at least 40 characters long, generated in your password manager |

Click **Save**, then redeploy. Keep this exact value private and do not change
it after staff members enroll: it encrypts their authenticator secrets. If it
is lost or changed, enrolled staff must be reset by an administrator and set
up MFA again.

## Staff enrollment

1. Sign in as a staff member.
2. Click **Sign-in security** at the bottom of the left menu.
3. Enter the current password.
4. In an authenticator app, choose **add account manually**, choose a
   time-based code, and copy the displayed key.
5. Enter the newest six-digit code from the app.
6. Save the ten recovery codes in a password manager. They are displayed only
   once and each can be used once.

At later sign-ins, the password creates a short-lived verification checkpoint,
not a normal session. The authenticator or a recovery code is required to turn
that checkpoint into a session.

## Privacy and recovery

- Authenticator secrets are AES-256-GCM encrypted before database storage.
- Recovery codes are stored only as SHA-256 hashes.
- The database never stores a plain recovery code.
- Patient, family, and referral-partner accounts are deliberately outside this
  staff MFA flow.
- A password reset ends all active sessions and unfinished MFA checkpoints.
