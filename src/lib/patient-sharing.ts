// src/lib/patient-sharing.ts
//
// "Who can see my care": the patient's own view of the family members they
// have shared parts of their care with. Reading only. Recording and
// withdrawing a permission stays with the office (src/lib/family-consents.ts,
// the only file that writes the table).
//
// THE RULES (same two doors as the rest of the patient portal)
//   1. PERMISSION  the account must hold portal.read. A hard stop.
//   2. OWNERSHIP   the patient record is the ONE linked to this account, in
//                  this account's own organization, active or on hold
//                  (PORTAL_STATUSES, shared with getMyCare). The function
//                  takes NO patient id, so there is nothing to forge.
//
// An account that holds the permission but is linked to no record gets null
// (the screen says the account is not connected). It never falls back to
// "show everybody".
//
// WHAT COMES BACK: only permissions still in force (not withdrawn, not run
// out), for THIS patient. For each: the family member's name, how they are
// related, which parts are shared (as plain words) and when it ends. Never
// an e-mail address, an id of a person, who recorded it, or anything from
// another patient's consents.

import "server-only";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/auth/authorize";
import { loadActor } from "@/lib/auth/actor";
import { PORTAL_STATUSES } from "@/lib/patient-portal";
import {
  cleanScopes,
  consentScopeLabel,
  relationshipLabel,
} from "@/lib/family-constants";

export interface SharedWith {
  name: string;
  relationshipLabel: string;
  scopeLabels: string[];
  // When the permission ends, or null for "until withdrawn".
  sharedUntil: Date | null;
}

export async function getWhoCanSeeMyCare(
  userId: string,
  now: Date = new Date(),
): Promise<SharedWith[] | null> {
  // 1. Permission - a hard stop, throws AuthorizationError.
  await requirePermission(userId, "portal.read");

  // 2. Ownership - the organization comes from this person's OWN row.
  const actor = await loadActor(userId);
  const patient = await prisma.patient.findFirst({
    where: {
      userId,
      organizationId: actor.organizationId,
      status: { in: PORTAL_STATUSES },
    },
    select: { id: true },
  });
  if (!patient) return null;

  const rows = await prisma.familyConsent.findMany({
    where: {
      patientId: patient.id,
      organizationId: actor.organizationId,
      revokedAt: null,
      OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
    },
    select: {
      relationship: true,
      scopes: true,
      expiresAt: true,
      familyUser: { select: { name: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  return rows.map((c) => ({
    name: c.familyUser.name,
    relationshipLabel: relationshipLabel(c.relationship),
    scopeLabels: cleanScopes(c.scopes)?.map(consentScopeLabel) ?? [],
    sharedUntil: c.expiresAt,
  }));
}
