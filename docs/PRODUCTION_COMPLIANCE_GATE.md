# Production compliance gate

## New operational package

Before real patient information is processed, complete and approve these linked records:

- [Backup and restore runbook](BACKUP_AND_RESTORE_RUNBOOK.md), including a successful isolated restore drill.
- [Retention and secure disposal draft](DATA_RETENTION_AND_DISPOSAL.md), including legal-hold handling and approved periods.
- [Incident response plan](INCIDENT_RESPONSE_PLAN.md), including named contacts and a tabletop exercise.
- [Compliance evidence register](COMPLIANCE_EVIDENCE_REGISTER.md), with evidence attached outside the public repository.
- [Legal documents workbook](LEGAL_DOCUMENT_WORKBOOK.md), followed by organization and attorney approval of every public legal notice.

This is the short, non-negotiable checklist before Cheliv stores real patient
documents or accepts public care requests in production. Code can prepare the
guardrails; it cannot create legal agreements, run a real anti-malware engine,
or make a provider compliant by itself.

## 1. Real document malware scanning

Do **not** upload real patient documents until all of these are true:

1. Select a scanner that your organization has approved for protected health
   information, including the required contract or business-associate agreement.
2. Run the scanner in an isolated service with read-only access to the private
   R2 bucket. It must never make the bucket public or log document contents.
3. Give that service a newly generated `DOCUMENT_SCANNER_TOKEN`, saved only as
   a secret. It reports only a document ID and `clean`, `rejected`, or
   `quarantined` to `POST /api/internal/document-scan`.
4. Test three harmless files: clean, scanner-rejected, and scanner-error. The
   clean file may become available; the other two must stay unavailable.
5. Add alerting and an operating procedure for a scanner outage. Files must
   remain `pending_scan`, never be released because the scanner is unavailable.

The app already enforces this last rule: R2 uploads start hidden and only the
authenticated scanner callback can release them.

## 2. Verified recovery-email domain

Testing can use Resend's test sender. Production recovery mail needs a domain
owned by Cheliv, verified in Resend, and a sender such as
`Cheliv <security@your-domain.example>`. In Resend, open **Domains**, add the
domain, then copy the DNS records it gives you into the domain's DNS provider.
Wait until Resend shows **Verified**, then set that sender as
`RESEND_FROM_EMAIL` in Vercel Production. Keep `RESEND_API_KEY` private.

The recovery email deliberately contains no diagnosis, patient name, or
account-status confirmation.

## 3. Public care-request anti-spam

Create a Cloudflare Turnstile widget in **Managed** mode for the exact current
Vercel hostname, for example `compassionate-care-plus.vercel.app`. In Vercel's
environment-variable screen, save the Site Key as **Config** named
`NEXT_PUBLIC_TURNSTILE_SITE_KEY`; the `NEXT_PUBLIC_` prefix means it is safely
visible to browsers by design. Save the Secret Key as **Secret** named
`TURNSTILE_SECRET_KEY`. Add both for Production, then redeploy. The server
checks the proof, its action, and the hostname before saving a request. Do not
put the secret key in source code, a `NEXT_PUBLIC_` variable, GitHub, or chat.

## 4. Operational checks

- Confirm organization scoping and consent rules with representative accounts.
- Confirm audit logs contain events, never message text or document contents.
- Confirm backups, retention, breach response, and least-privilege access
  procedures are approved by the people responsible for compliance.
- Verify the Vercel, Neon, Cloudflare, and email-provider plans and agreements
  meet your real regulatory and contractual requirements before handling PHI.
