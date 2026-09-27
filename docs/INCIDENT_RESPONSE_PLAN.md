# Security and Privacy Incident Response Plan

## Status

This is an operational draft for a demonstration system. The organization must assign the named roles, emergency contacts, and legal/privacy counsel before it processes real patient information.

## Purpose

An incident is any suspected loss, unauthorized access, disclosure, alteration, ransomware event, compromised credential, malware finding, or material service outage affecting Cheliv data or availability.

## Roles to assign

| Role | Responsibility | Named person and contact |
| --- | --- | --- |
| Incident lead | Coordinates decisions, timeline, and updates | [ASSIGN] |
| Technical lead | Contains, investigates, restores services | [ASSIGN] |
| Privacy or security officer | Assesses privacy impact and required notifications | [ASSIGN] |
| Executive owner | Approves business decisions and external messages | [ASSIGN] |
| Legal counsel | Gives legal advice and approves required notices | [ASSIGN] |

## Severity

| Level | Meaning | Response target |
| --- | --- | --- |
| SEV 1 | Suspected exposure of sensitive data, ransomware, active account compromise, or broad outage | Begin immediately |
| SEV 2 | Material security control failure or limited outage with credible risk | Begin within 1 hour |
| SEV 3 | Contained issue with no evidence of data exposure | Begin same business day |
| SEV 4 | Low-risk defect or question | Track and plan a fix |

## First 30 minutes

1. Create an incident record: time discovered, reporter, systems affected, and observed facts. Do not speculate.
2. Name an incident lead and set a severity level.
3. Preserve evidence: audit logs, deployment identifiers, affected account IDs, provider alerts, and timestamps. Do not alter or delete logs.
4. Contain the risk using the smallest safe action:
   - revoke one suspicious session or disable a compromised account;
   - rotate a suspected secret;
   - disable document uploads if scanning is failing;
   - disable a public form if it is being abused;
   - pause deployments if a release caused the issue.
5. Keep private information out of chat, email subject lines, and general-purpose tickets.

## Investigation and recovery

1. Identify what happened, when, which systems and accounts were involved, and what evidence supports each fact.
2. Determine whether the issue is still active.
3. Restore only from a known-safe recovery point using `docs/BACKUP_AND_RESTORE_RUNBOOK.md`.
4. Verify least-privilege access, document authorization, scanner status, and audit logging before returning to normal operation.
5. Rotate credentials and revoke sessions as appropriate.
6. Record every containment and recovery decision.

## Communications and notifications

Only the executive owner, privacy officer, and legal counsel approve external statements or notices. The technical team provides facts, not legal conclusions.

For US HIPAA-regulated use, the organization and any business associates must follow the applicable Breach Notification Rule. HHS explains that notices following a breach of unsecured protected health information generally have a 60-day outer deadline, while the exact obligations and timing depend on the facts and legal analysis. See the official HHS guidance linked from the production gate.

## After the incident

Within five business days of containment, hold a blameless review:

1. What happened and what evidence establishes the timeline?
2. What protected the system or limited harm?
3. What failed or was missing?
4. What fix has an owner and due date?
5. Was the backup and restore process adequate?
6. Does training, policy, vendor configuration, or code need to change?

## Incident record template

```text
Incident ID:
Opened at and timezone:
Incident lead:
Severity:
Systems affected:
Known facts:
Containment actions and times:
Evidence preserved:
Data categories potentially involved:
Legal/privacy review owner:
Recovery point and verification:
External communications approved by:
Follow-up actions, owners, and due dates:
Closed at:
```

