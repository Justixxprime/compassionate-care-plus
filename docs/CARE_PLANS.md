# CARE_PLANS.md

**Added:** 19 September 2026
**Milestone D, slice 3.** Patients came first, visits second, care plans third.

---

## What a care plan is

What the care team is trying to achieve for one patient: a short title, a summary, and a list of goals. For example "Steady recovery at home", with goals like "Walk to the mailbox and back with her walker, twice a week."

This is the first table in the project that holds real clinical CONTENT, meaning words a clinician wrote. Visits only said "a visit is happening". A care plan says something about a person. That is why its access rules are stricter than visits.

It deliberately has NO diagnoses, interventions, medications, versions or signatures. Those belong to the clinical record and come later.

## Three questions, not two

Patients and visits ask two questions: does your role hold the permission, and can you reach this patient. Care plans ask a third.

1. **Permission.** `care_plans.read`, `care_plans.create`, `care_plans.update`, `care_plans.approve`. A hard stop (`requirePermission`).
2. **Relationship.** Can this person reach the patient at all? This comes from `getPatientScope()` in `src/lib/patients.ts`, the same code patients and visits use. There is still exactly one copy of that rule.
3. **Team.** WRITING a plan also needs the person to be on THIS patient's care team right now (`isActiveCareTeamMember()`, also in `patients.ts`, built on the same `activeAssignmentFilter`).

Reading needs 1 and 2. Writing (start a plan, edit it, add or remove goals, mark goals met) needs 1, 2 and 3.

The reason for the third question: an administrator can legitimately READ every plan, but that does not make them the author of clinical content for a patient they are not caring for. The demo admin holds every permission and can reach every patient, and still cannot write a plan for Eleanor Whitfield, because nobody has put the admin on her care team.

## Who can do what

| Action | Needs | Notes |
|---|---|---|
| See plans | `care_plans.read` + reach the patient | Administrative roles see all. Everyone else sees plans of patients they are assigned to. |
| Start a draft | `care_plans.create` + reach + on the team | Active patients only. One draft per patient at a time. |
| Edit title and summary | `care_plans.update` + reach + on the team | Drafts only. Any team member can, since a plan belongs to the team, not one person. |
| Add or remove a goal | same as edit | Drafts only. At most 15 goals. |
| Approve a draft | `care_plans.approve` + reach | Never the author. Needs at least one goal. Refused if the patient already has an active plan. |
| Complete an active plan | `care_plans.approve` + reach | |
| Mark a goal met | `care_plans.update` + reach + on the team | Active plans only. |
| Discard a draft | the team (update + on the team), OR an approver | Ends as "archived". |

Who holds what today: SUPER_ADMIN holds everything. ADMIN holds `read` and `approve`. NURSE holds `read`, `create` and `update`. Every other role still holds none.

## The four-eyes rule

The person who wrote a plan cannot be the one who approves it. This holds even for someone with every permission. The attempt is refused and written to the audit log. (Only the demo admin can approve in the browser, and the admin is never an author, so in the browser you meet this rule by seeing that no nurse is ever offered an Approve button. The test script proves the harder case: an account that holds every permission AND is on the team writes a plan and is refused when approving it.)

## Statuses

```
draft   -> approve  -> active
active  -> complete -> completed
draft   -> discard  -> archived (shown as "Discarded")
```

The whole table lives in `PLAN_TRANSITIONS` in `src/lib/care-plan-constants.ts`. An action that is not listed for a plan's current status cannot happen. `completed` and `archived` are final.

## Approved wording is locked

Once a plan is active, its title, summary and goals cannot be edited, added to or removed. What was approved is never quietly changed. Only one thing still moves: a goal can be marked met. If the situation changes, the plan is completed and a new draft is written. A new draft may be written while the old plan is still active, so the next plan is ready when the old one closes, but it cannot be approved until the old one is completed. A patient has at most one draft and one active plan.

Real revision history, so an approved plan can be amended with a visible trail, is a later piece of work.

## What a refusal looks like

- Written to the audit log as `access_denied`, outcome `denied`, so the attempt is on record.
- A plan that does not exist and a plan the person may not reach give the SAME answer: "That care plan could not be found." Otherwise guessing ids would show which ones are real.
- When the person can reach the plan but is not on the team, they are told plainly that only the care team can write it. They can already see the plan, so nothing is revealed.

## New audit actions

`care_plan_created`, `care_plan_updated`, `care_plan_goal_added`, `care_plan_goal_removed`, `care_plan_goal_met`, `care_plan_approved`, `care_plan_completed`, `care_plan_discarded`, plus `access_denied` for refusals. As always they record that it happened, never what the plan said.

## Files

- `prisma/schema.prisma`: `CarePlan` and `CarePlanGoal` models (new migration needed)
- `src/lib/care-plans.ts`: every care plan rule lives here
- `src/lib/care-plan-constants.ts`: statuses, the transition table, size limits
- `src/lib/care-plans-actions.ts`: thin server actions, identity comes from the session only
- `src/lib/patients.ts`: gained `isActiveCareTeamMember()`
- `src/app/care-plans/page.tsx`, `create-plan-form.tsx`, `plan-controls.tsx`: the bare proof page
- `scripts/verify-access.ts`: sections 2b and 10a to 10i
- `prisma/seed.ts`: new permission `care_plans.create`, NURSE now holds create and update, two synthetic plans

## Demo data and what to click

Eleanor Whitfield has an ACTIVE plan written by Demo Nurse and approved by Demo Admin, with one goal already met. Marcus Delgado has a DRAFT written by Demo Nurse Two, waiting for approval. Priya Raman has no plan.

- As **admin**: both plans are visible. Marcus's draft offers Approve and Discard. Eleanor's plan offers Complete. No edit boxes anywhere, and no "start a plan" form.
- As **nurse one**: only Eleanor's plan, with Mark met buttons on open goals. The start form offers only Eleanor.
- As **nurse two**: only Marcus's draft, with edit, add goal, remove and discard. No Approve button, because nurses do not hold that permission.

## Proving it, not trusting it

`npm run verify:access` now runs about 175 checks. The care plan part covers the permission gate, reading scope, writing needs the team (including SUPER_ADMIN refused), validation limits, the four-eyes rule, one active plan, locked wording, discarding, what each person is shown, and the audit trail.

It was also tested the other way. Five rules were broken on purpose in a copy of the code (four-eyes, team requirement, locked wording, the relationship check, one active plan) and the script failed on exactly those rules each time.

Worth knowing: when the four-eyes rule was removed, the plan still could not be approved, because the "one active plan" rule caught it as a second line of defence. The script still flagged it, because the message was wrong and the denial was not on record.

## Known gaps, written down honestly

- **One active plan per patient is enforced in code, with a tiny race.** Two approvers clicking at the same instant could both pass the check. The real fix is a database constraint that allows only one active plan per patient. Prisma cannot describe that kind of constraint in the schema, so it needs a hand-written migration step later.
- **No revision history.** An active plan is locked, not versioned.
- **Reading a plan is not audit-logged.** Only changes and refusals are. Opening a full chart will need view logging when charts exist.
- **Goals are plain text.** No target dates, measures or owners yet.
- **CLINICAL_SUPERVISOR and CARE_COORDINATOR hold no permissions.** A clinical supervisor is the natural real-world approver, so their permission sets are the next decision to make.
- **Patients and families cannot see plans yet.** That comes with their portals.
