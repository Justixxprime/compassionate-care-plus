# CARE_TEAMS.md

How a person gets onto a patient's care team, and how they come off it. Written on 21 September 2026, the first step of Milestone E (E0). There are no screens for this yet: it is the rules and the tests, so the screens in E2 have something safe to stand on.

## Why this exists

A care team is the short list of staff looking after ONE patient. Being on it is what lets a nurse see that patient at all. Until now, the only thing that could put someone on a team was the seed script. So when I accepted a referral and a new patient was created (chibueze obioma, in my own testing), that patient had nobody on the team. Nobody could see them, schedule them or write a plan for them. This round fixes that.

## The two new permissions

- `care_team.read` - look at a patient's team, and the list of patients who still need a primary nurse.
- `care_team.manage` - add someone to a team, or end their assignment.

Who holds them: SUPER_ADMIN and ADMIN hold both. CARE_COORDINATOR holds both. CLINICAL_SUPERVISOR holds read only. Nurses hold neither (a nurse's own patients are already visible to her through her assignments).

## The office roles now have real permission sets

- CARE_COORDINATOR: patients.read, patients.create, referrals.read, referrals.manage, visits.read, visits.create, visits.update, care_team.read, care_team.manage. `patients.create` is there because accepting a referral about someone new creates the patient, and without it a coordinator could start a review but never finish the job. No clinical content: no care plans, no documents.
- CLINICAL_SUPERVISOR: patients.read, care_plans.read, care_plans.approve, visits.read, documents.read, care_team.read. A supervisor can approve a plan someone else wrote, and read visits and documents. A supervisor cannot write a plan, schedule, or change a team.

Open decision (yours): "restricted" documents (insurance, identification) are restricted to administrative ROLES, and a supervisor is one, so a supervisor sees those scans. The test records this as the current behaviour, not as a claim that it is right.

## The rules for adding someone

Everything is in `src/lib/care-team.ts`. `assignToCareTeam` asks, in order:

1. PERMISSION: `care_team.manage`. No permission, it stops and writes to the audit log.
2. REACH: the patient must be one this person can reach. A made-up patient, a patient in another organization and a patient out of reach all get the same words: "That patient could not be found."
3. PLACE: primary nurse, nurse or caregiver. Anything else is refused.
4. PATIENT: only an ACTIVE patient can be given a new team member.
5. PERSON: same organization, and they must REALLY hold a role that may fill that place (a nurse for the nurse places, a caregiver for the caregiver place). This is checked in the database, never from the form. Every wrong person (a nurse in the caregiver place, an administrator, a supervisor, someone who does not exist, someone from another organization) gets the same words, so nothing is given away.
6. NOT TWICE: nobody is on the same team twice at once, and a patient has at most one primary nurse at a time. This last check runs inside a serializable transaction that retries, so two coordinators clicking at the same moment cannot both put a primary nurse on the same patient.

## The rules for taking someone off

`endCareTeamAssignment` sets an end date. It never deletes anything, so the history of who looked after whom stays. The person loses access to that patient the same instant. Visits already on the calendar for that person are NOT cancelled (that is a human decision), but the answer tells the caller how many there are.

## The worklist

`listPatientsNeedingTeam` lists active patients with no active primary nurse, limited to the patients the viewer can reach. This is what a coordinator opens first. A patient made from a referral appears on it straight away.

## What the audit log holds

`care_team_assigned` and `care_team_ended` (resource type `care_team_member`), and `access_denied` for every refusal. Never a name.

## How it was tested

`npm run verify:access` now runs 553 checks. New sections: 0 (the shared helpers exist once), 13a to 13e (permission sets, the gate, what the form offers, every wrong way to add someone, two people at once, another organization), 14a to 14c (the coordinator and the supervisor by really being them, and the whole path from referral to patient to care team), 15a to 15c (ending, reading, audit). I broke 18 rules on purpose, one at a time, and the script failed on each one.

## Not built yet

No screens and no server actions for this: they arrive in E2, the Care Command Center. Nothing here changes the database structure, so there is no migration this round.
