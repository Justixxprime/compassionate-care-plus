// src/lib/auth/actor.ts
//
// The three small helpers every access-checked service file needs, in ONE
// place.
//
// Before this file existed, visits, care plans, documents and referrals
// each carried their own copy of loadActor and auditDenied (and three of
// them a copy of auditAllowed). The copies were identical and tested, but
// four copies of a security helper is how a later fix lands in three of
// them and the fourth quietly stays weaker. Now there is one copy, and
// `npm run verify:access` reads every service file and fails if anyone
// writes a private copy again (section 0 of that script).
//
//   loadActor      who is asking. The organization comes from the person's
//                  OWN row, never from anything a caller passes in.
//   auditDenied    writes the "access_denied" entry every refusal leaves.
//                  The caller then answers with the same vague words it
//                  would use for a thing that does not exist.
//   auditAllowed   writes the entry for something that DID happen (a plan
//                  created, a document downloaded, a referral accepted).
//
// None of them ever records what a record said, only that something
// happened to it - see docs/AUDIT_LOGGING.md.

import "server-only";
import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "@/lib/audit/log";

export interface Actor {
  id: string;
  email: string;
  organizationId: string;
}

export async function loadActor(userId: string): Promise<Actor> {
  return prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: { id: true, email: true, organizationId: true },
  });
}

export async function auditDenied(
  actor: Actor,
  resourceType: string,
  resourceId?: string,
): Promise<void> {
  await writeAuditLog({
    actorUserId: actor.id,
    actorEmail: actor.email,
    action: "access_denied",
    resourceType,
    resourceId,
    outcome: "denied",
  });
}

export async function auditAllowed(
  actor: Actor,
  action: string,
  resourceType: string,
  resourceId: string,
): Promise<void> {
  await writeAuditLog({
    actorUserId: actor.id,
    actorEmail: actor.email,
    action,
    resourceType,
    resourceId,
    outcome: "allowed",
  });
}
