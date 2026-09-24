# FAMILY_PORTAL.md

**Built:** 24 September 2026 (Milestone E5, round 3: the family portal and consent gating)
**Screens:** `/family` (called "Shared with me" in the menu) for the family member, `/consents` (called "Family access") for the office.
**Code:** `src/lib/family-portal.ts` (what a family member sees), `src/lib/family-consents.ts` (recording and withdrawing a consent), `src/lib/patient-view.ts` (the four things both portals show), `src/lib/family-constants.ts` (the fixed lists), `scripts/verify-family.ts` (the proof).

## In plain words

A patient decides who in their family may look at parts of their care. The office writes that decision down (a "consent"). The family member then signs in and sees exactly what the patient chose, and nothing else. Withdraw the consent and the family member loses access the same second.

**What a patient can choose to share** (each one on its own):

1. **Visit schedule:** dates, times and the name of the person coming, for upcoming and recent visits.
2. **Care team:** the names and jobs of the people looking after them.
3. **Care plan:** the approved plan and its goals.

Nothing else can be shared here. No visit notes, tasks, documents, referrals, messages, e-mail addresses or date of birth. Each of those would need its own design first.

If a part is not shared, the family screen says so plainly ("Eleanor has not shared the care plan with you"). That is different from "nothing to show yet".

## The permission design

Two new permissions (38 in total now):

| Permission | Held by | What it means |
|---|---|---|
| `family.read` | AUTHORIZED_FAMILY, SUPER_ADMIN | See what patients have chosen to share with ME. Nothing more. |
| `consents.manage` | ADMIN, SUPER_ADMIN | Record, list and withdraw family consents for patients I can reach. |

The family role holds exactly `family.read`. A coordinator and a supervisor do not hold `consents.manage` (your decision if that should change: it is one word in the seed).

**Reading (family member):** three things must all pass, every request.

1. **Permission.** The account holds `family.read`. Anyone else (nurse, patient account, caregiver, supervisor, coordinator) is refused and the refusal is audited.
2. **Consent.** There is a consent row for THIS account and a patient, not withdrawn, not run out, in my own organization, for a patient who is active or on hold. A discharged patient shows nothing.
3. **Scope.** The consent names which parts. A part that is not named is never even read from the database.

`getFamilyCare` takes no patient id, so there is nothing in the browser to change to see somebody else. A family account with no consent sees nobody, never "everybody".

**Recording (office):** permission (`consents.manage`) AND reach to the patient AND all of these:

- The form makes the person confirm that the patient has given permission (a signed form is on file). The server refuses without it.
- The family account must be a real account in this organization holding the family role, and must not be the patient's own account.
- A patient must be active or on hold. A made-up patient, a discharged patient, an unreachable patient and another organization's patient all get the same words.
- At most one consent per person and patient in force, and at most 10 people per patient. Both are checked inside a transaction that locks the patient's row, so two people clicking at the same moment cannot both get in.
- A consent is written once and never edited. To change what is shared, withdraw it and record a new one. Nothing is deleted, so there is always a record of who could see what, and until when.
- How long: 90 days, 1 year, or until the patient withdraws it.

The audit log records THAT a consent was recorded or withdrawn (`family_consent_recorded`, `family_consent_withdrawn`), never a name, a relationship or what was shared. Every refusal that could reveal something is audited as denied.

## The one schema change

New table `family_consents`: patient, family account, relationship label, the list of shared parts, who recorded it, when it ends (empty means until withdrawn), and who withdrew it and when. Foreign keys are `Restrict`, so nothing that has a consent can be removed by accident.

**Migration:** `npx prisma migrate dev --name add_family_consents` (you run it; no SQL is shipped).

## Demo accounts

`demo.family@cheliv.test` (same demo password) is Claire Whitfield, Eleanor's daughter. Eleanor's consent shares the visit schedule and the care team, and NOT the care plan, so the screen shows both a shared part and a part that says "not shared". Sign in as `demo.admin@cheliv.test` and open Family access to see the consent, withdraw it, and record it again.

## What is not built yet (on purpose)

- Nothing lets an administrator create a family account from a screen. Today the seed creates the demo one. The "create staff account" flow (open item in `REVIEW_MILESTONE_D.md`) is the place for family accounts and for linking a patient account.
- A patient cannot yet see who has access to their care. A "who can see my care" panel on My care is a small, natural next step.
- Documents and messages for family. Each needs its own permission design.
- Expiry reminders (a consent that ends soon).

## Shared code with the patient portal

The patient portal and the family portal show the same four things (upcoming visits, recent visits, care team, active plan). They now load them from one file, `src/lib/patient-view.ts`, and draw them with one set of components, `src/components/app/care-view.tsx`, so the two can never drift apart. The file decides no access: each portal proves its own right first, and only then calls it.

## How it is proved

`npm run verify:family` tries to break each rule against a real database (156 checks). In the build environment nineteen rules were also broken on purpose, one at a time (withdrawn and expired consents still shown, scopes ignored, discharged patients shown, patient or consent organization not checked, permission not asked, draft plan shown, ended team assignments shown, confirmation not required, duplicates allowed, row lock removed, limit removed, role not checked, patient's own account allowed, reach not checked when recording or withdrawing, discharged patient accepted, consents.manage not asked, list ignoring reach), and the script failed each time. See `NEXT_STEP.md` for the expected numbers.
