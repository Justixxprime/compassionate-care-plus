# Data Retention and Secure Disposal Policy Draft

## Status and rule

**Draft for organization and attorney review. It is not a final legal policy.**

No record is deleted merely because it is old. The organization must approve retention periods based on applicable federal, state, payer, licensing, employment, contract, and litigation-hold duties.

## Core rules already supported by the application

- Clinical and document records are designed for archival, not casual hard deletion.
- Access is role-, relationship-, and consent-limited.
- Audit events record that an action occurred, not the contents of a private message or record.
- Password-reset tokens are time-limited and stored as hashes.
- Secure notifications do not include message text or patient names.

## Retention schedule to approve

| Data category | Examples | Proposed handling now | Final period and owner |
| --- | --- | --- | --- |
| Clinical and care records | care plans, visit records, notes | Preserve; no automated deletion | [ATTORNEY/OWNER TO APPROVE] |
| Documents and versions | uploaded patient and family documents | Preserve while authorized; do not delete scans or evidence casually | [ATTORNEY/OWNER TO APPROVE] |
| Audit and security events | access, denial, administrative changes | Preserve and protect from alteration | [ATTORNEY/OWNER TO APPROVE] |
| Secure messages | message metadata and content | Preserve subject to approved clinical-record policy | [ATTORNEY/OWNER TO APPROVE] |
| Sessions and MFA challenges | active sessions, recovery challenges | Expire and revoke under security controls | [SECURITY OWNER TO APPROVE] |
| Password-reset tokens | one-time recovery tokens | Expire promptly; do not retain token value | [SECURITY OWNER TO APPROVE] |
| Care-request leads | public request information | Minimize collection; retain only for approved intake period | [OWNER TO APPROVE] |
| Backups | database and document recovery copies | Retain only for approved recovery window | [OWNER TO APPROVE] |

## Legal hold procedure

If the organization receives a preservation request, lawsuit notice, audit request, investigation notice, or attorney instruction:

1. Stop ordinary deletion for the affected records and backups.
2. Record the matter, scope, start date, responsible attorney, and systems affected.
3. Limit access to the hold record and preserve the original audit trail.
4. The attorney or designated owner releases the hold in writing. Only then may normal disposal resume.

## Secure disposal procedure

1. Confirm the approved retention period ended and no legal hold applies.
2. Have an authorized owner approve the disposal list.
3. Remove access first: revoke sharing grants, signed links, sessions, and service credentials where needed.
4. Use the provider's documented secure deletion process for database data, document objects, backups, and logs.
5. Record what was disposed, authority, date, operator, provider confirmation, and exceptions. Do not place private content in the disposal log.
6. Check that a deleted document cannot be downloaded through the application.

## What not to do

- Do not create an automatic job that deletes clinical data until the retention schedule and legal-hold workflow are approved.
- Do not delete a document just because a family consent expires. Expiry changes access; it does not settle record-retention duties.
- Do not export patient data to personal devices or email it to create an unofficial backup.

