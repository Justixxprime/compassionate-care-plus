// src/lib/family-portal.ts
//
// The family portal: what a family member sees about a patient WHO HAS
// CHOSEN TO SHARE. Everything about who may see what lives in this one
// file. The page and the dashboard call getFamilyCare(); nothing else reads
// a patient's information for a family member.
//
// THE PERMISSION DESIGN (docs/FAMILY_PORTAL.md explains it in plain words)
//
//   family.read   the new permission. It means: "see what patients have
//                 chosen to share with ME". It opens no staff screen, no
//                 other patient, no note, no document, no task.
//
// The AUTHORIZED_FAMILY role holds exactly that key and nothing else. Three
// things must all pass:
//
//   1. PERMISSION  does the account hold family.read? (a hard stop)
//   2. CONSENT     is there a consent for THIS account and THIS patient
//                  that has not been withdrawn and has not run out? The
//                  consent is a row in family_consents. It is checked on
//                  every request, so withdrawing it ends access at once.
//   3. SCOPE       the consent names WHICH parts are shared ("visits",
//                  "care_team", "care_plan"). A part that is not named is
//                  never even queried. The screen says the patient has not
//                  shared it.
//
// The patient and the organization come from the consent row and this
// person's OWN row. getFamilyCare takes no patient id, so there is nothing
// in the browser to change to see somebody else. A patient who has been
// discharged shows nothing. A consent made in another organization shows
// nothing.
//
// Never shown, whatever the consent says: visit notes and addenda, tasks,
// documents, referrals, office notes, e-mail addresses, date of birth, ids
// of people, other patients, drafts or finished plans.

import "server-only";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/auth/authorize";
import { loadActor } from "@/lib/auth/actor";
import {
  loadActivePlan,
  loadCareTeam,
  loadRecentVisits,
  loadUpcomingVisits,
  type MyCarePlan,
  type MyTeamMember,
  type MyVisit,
} from "@/lib/patient-view";
import { isConsentScope, relationshipLabel } from "@/lib/family-constants";
import { UNRESTRICTED_CATEGORY_KEYS, categoryLabel } from "@/lib/document-constants";

// A discharged patient shows nothing. On hold still does.
const FAMILY_STATUSES = ["active", "on_hold"];

export interface SharedCare {
  // "Eleanor Whitfield". The family member knows the patient's name, and
  // needs it to tell two patients apart. Never a date of birth or an id.
  patientName: string;
  patientFirstName: string;
  relationshipLabel: string;
  // When the consent ends, or null for "until withdrawn".
  sharedUntil: Date | null;
  // Each is null when the patient has NOT shared that part. That is
  // different from an empty list (shared, but nothing to show yet).
  visits: { upcoming: MyVisit[]; recent: MyVisit[] } | null;
  team: MyTeamMember[] | null;
  plan: { plan: MyCarePlan | null } | null;
  documents: { id: string; title: string; categoryLabel: string; createdAt: Date }[] | null;
}

export async function getFamilyCare(
  userId: string,
  now: Date = new Date(),
): Promise<SharedCare[]> {
  // 1. Permission - a hard stop, throws AuthorizationError.
  await requirePermission(userId, "family.read");

  // 2. Consent - the organization comes from this person's OWN row, the
  //    patient from the consent. Withdrawn and run-out consents are not
  //    even selected.
  const actor = await loadActor(userId);
  const consents = await prisma.familyConsent.findMany({
    where: {
      familyUserId: userId,
      organizationId: actor.organizationId,
      revokedAt: null,
      OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
      patient: {
        organizationId: actor.organizationId,
        status: { in: FAMILY_STATUSES },
      },
    },
    select: {
      relationship: true,
      scopes: true,
      expiresAt: true,
      patient: { select: { id: true, firstName: true, lastName: true } },
    },
    orderBy: [{ patient: { lastName: "asc" } }, { patient: { firstName: "asc" } }],
    take: 50,
  });

  // 3. Scope - only the named parts are read.
  const out: SharedCare[] = [];
  for (const c of consents) {
    const scopes = new Set(c.scopes.filter(isConsentScope));
    const patientId = c.patient.id;
    const orgId = actor.organizationId;

    const [upcoming, recent, team, plan, documents] = await Promise.all([
      scopes.has("visits") ? loadUpcomingVisits(patientId, orgId, now) : null,
      scopes.has("visits") ? loadRecentVisits(patientId, orgId) : null,
      scopes.has("care_team") ? loadCareTeam(patientId, orgId, now) : null,
      scopes.has("care_plan") ? loadActivePlan(patientId, orgId) : null,
      scopes.has("documents") ? prisma.document.findMany({ where: { organizationId: orgId, patientId, status: "active", category: { in: UNRESTRICTED_CATEGORY_KEYS } }, select: { id: true, title: true, category: true, createdAt: true }, orderBy: { createdAt: "desc" }, take: 50 }) : null,
    ]);

    out.push({
      patientName: `${c.patient.firstName} ${c.patient.lastName}`,
      patientFirstName: c.patient.firstName,
      relationshipLabel: relationshipLabel(c.relationship),
      sharedUntil: c.expiresAt,
      visits: upcoming && recent ? { upcoming, recent } : null,
      team,
      plan: scopes.has("care_plan") ? { plan } : null,
      documents: documents?.map((document) => ({ id: document.id, title: document.title, categoryLabel: categoryLabel(document.category), createdAt: document.createdAt })) ?? null,
    });
  }
  return out;
}
