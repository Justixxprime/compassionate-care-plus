# Private R2 document storage

## Current state

Cheliv can read a document either from the current PostgreSQL `document_files`
table or from an opaque, private Cloudflare R2 object key. The database remains
the active upload path. R2 is configured only for synthetic demo files.

No document URL is stored or returned. Every download still goes through the
application's permission, organization, reach, category, consent, and audit
checks before bytes are read from either storage location.

## Scan gate

Each document has one scan state:

- `pending_scan` — hidden everywhere
- `clean` — eligible for normal existing access rules
- `rejected` — hidden everywhere
- `quarantined` — hidden everywhere

The default is `clean` so the existing local synthetic database remains usable
after migration. A future R2 upload pipeline must create records as
`pending_scan`, then only a verified scanning workflow may change them to
`clean`. A browser, staff form, or ordinary server action must never claim a
file is clean.

The internal scan-result endpoint is deliberately separate from the browser
application. It accepts only a request authenticated with
`DOCUMENT_SCANNER_TOKEN`, and it can move a pending document only to `clean`,
`rejected`, or `quarantined`. It returns no document contents or patient data.
Do not set that token or connect this endpoint until a genuine scanning service
is selected and configured.

## Do not enable for real patient information

R2 demo storage is not a substitute for the production compliance, agreement,
malware-scanning, incident-response, and retention work required before real
protected information is stored. Do not make the bucket public or add an R2
public/custom domain for documents.

## Required private environment variables

Keep these in `.env.local` locally and Vercel's encrypted environment-variable
screen for deployments. Never commit or paste their values in chat:

```text
R2_ACCOUNT_ID
R2_ACCESS_KEY_ID
R2_SECRET_ACCESS_KEY
R2_BUCKET_NAME
DOCUMENT_SCANNER_TOKEN
```
