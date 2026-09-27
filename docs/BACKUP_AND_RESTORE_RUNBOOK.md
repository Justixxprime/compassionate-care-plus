# Backup and Restore Runbook

## Purpose

This runbook explains how Cheliv protects and restores application data. It is for the organization owner, technical administrator, and privacy or security lead.

**Current status: demonstration only.** This project must not hold real patient information until this runbook is approved, the provider capabilities are verified, and a restore drill has passed.

## What must be protected

| Asset | Current provider | Protection goal |
| --- | --- | --- |
| Application database | Neon PostgreSQL | Recover records, audit events, sessions, and configuration |
| Private documents | Cloudflare R2 | Recover approved document objects and their metadata |
| Application source | GitHub | Recover a known-safe application version |
| Deployment configuration | Vercel | Recover deployment settings without exposing secrets |
| Secrets | Vercel environment variables and provider consoles | Rotate and restore access safely; never place secrets in Git |

## Decisions the organization must approve

Fill these in with the owner, privacy officer, attorney, and providers before real use.

| Decision | Approved value | Owner | Date |
| --- | --- | --- | --- |
| Recovery point objective: maximum acceptable data loss | [TO BE APPROVED] | [NAME] | [DATE] |
| Recovery time objective: maximum acceptable outage | [TO BE APPROVED] | [NAME] | [DATE] |
| Database backup retention | [TO BE APPROVED] | [NAME] | [DATE] |
| Document backup retention | [TO BE APPROVED] | [NAME] | [DATE] |
| Restore-drill frequency | At least annually is recommended; choose the approved schedule | [NAME] | [DATE] |

## Daily and monthly checks

### Daily or automated

1. Confirm the production deployment is healthy in Vercel.
2. Confirm the Neon project is reachable and its backup or point-in-time recovery capability is enabled for the chosen plan.
3. Confirm Cloudflare R2 is reachable and the document bucket remains private.
4. Investigate failed document scans. A document that is not marked clean must remain unavailable.

### Monthly

1. Review provider backup settings and billing-plan limits.
2. Check that two authorized administrators can reach the provider accounts.
3. Review failed deployments, security events, and unusual access denials.
4. Record completion in the compliance evidence register.

## Restore drill: safe rehearsal

Never rehearse directly against the live production database or document bucket.

1. Choose a date and name an incident lead and a technical restorer.
2. Create an isolated, non-production Neon branch or database from an approved recovery point.
3. Restore only synthetic or appropriately authorized test data into that isolated environment.
4. Point a temporary preview deployment at the isolated database. Do not copy production secrets to a personal computer.
5. Verify these checks:
   - an administrator can sign in;
   - an assigned staff member can see only assigned synthetic patients;
   - an unassigned account is denied;
   - a private document needs authorization before download;
   - audit events still appear;
   - the application returns to normal after the test.
6. Record the start time, finish time, recovery point used, result, and any gaps in `docs/COMPLIANCE_EVIDENCE_REGISTER.md`.
7. Destroy the temporary environment when the drill ends, following the approved disposal process.

## If the database is unavailable

1. Open an incident using `docs/INCIDENT_RESPONSE_PLAN.md`.
2. Stop writes if there is a risk of corruption or duplicate work.
3. Check Neon status and the project dashboard. Do not repeatedly retry migrations against an unhealthy database.
4. Choose the last safe recovery point with the incident lead.
5. Restore into an isolated database first and verify the application there.
6. Obtain owner approval before changing the production connection string.
7. Update the Vercel `DATABASE_URL` secret only through Vercel. Redeploy and test the minimum critical flows.
8. Preserve logs, timestamps, and decisions for the incident record.

## If private documents are unavailable or corrupted

1. Stop document uploads and downloads if the issue may expose data.
2. Confirm the R2 bucket is private and access keys have not changed unexpectedly.
3. Use object versioning or a separately approved backup copy only if the organization has enabled it and documented it here.
4. Restore to an isolated location first, verify authorization and scan state, then return the object to service.
5. Do not bypass the malware scan gate to make a document available quickly.

## Secret loss or suspected exposure

1. Treat it as an incident immediately.
2. Rotate the affected credential in its provider console: Vercel, Neon, Cloudflare, Resend, or the scanner provider.
3. Update the replacement only as a Vercel secret or local ignored environment variable.
4. Revoke active sessions when authentication secrets or database credentials could have been exposed.
5. Search GitHub and deployment logs for the secret value only if the incident lead approves; do not paste it into tickets or chat.

## Evidence to keep

- Screenshot or export proving the chosen backup capability is enabled.
- Restore-drill record and result.
- List of authorized provider-account administrators.
- Incident records and remediation dates.
- Approval of recovery objectives and retention periods.

