// src/lib/document-grants.ts
//
// Sharing restricted documents, on purpose, one person at a time.
//
// THE PROBLEM THIS SOLVES
// Insurance cards and ID scans carry policy numbers and identity numbers.
// By default only the two administrator roles (SUPER_ADMIN and ADMIN) may
// see them. But sometimes an administrator wants a clinical supervisor to
// look at one patient's insurance card, for a reason only the
// administrator knows. This file is how they do that, and how they take
// it back.
//
// THE RULES
//   1. To share or take back you need the permission documents.grant AND
//      you must be one of the administrator roles yourself. (You can only
//      hand out what you can see.)
//   2. A share names ONE person, ONE patient and, optionally, ONE document:
//        patient only  = every restricted document of that patient,
//                        including ones filed later
//        with document = that single document
//   3. The person must be someone who can already open documents at all
//      (documents.read) and who already REACHES that patient. A share
//      never widens which patients someone can see, and never gives the
//      right to file, archive or share anything. It is permission to look
//      and download, nothing more.
//   4. A share can end by itself (7 days, 30 days) or last until an
//      administrator takes it back. Taking it back ends access at once.
//   5. Nothing is deleted. A share that ended is kept, with who made it
//      and who took it back.
//   6. Every wrong attempt (a person who cannot be given access, a made-up
//      patient or document) is refused in the same plain words and written
//      to the audit log as denied. The log records that a share was made
//      or taken back, never what a document said and never a name.
//
// WHERE THE DOCUMENT RULES LIVE
// The question "may this person open this restricted document?" is asked
// in src/lib/documents.ts, which uses getActiveGrantsFor and grantsCover
// from this file. Nothing else decides it.

import "server-only";
import { prisma } from "@/lib/prisma";
import { AuthorizationError, hasPermission, requirePermission } from "@/lib/auth/authorize";
import { auditAllowed, auditDenied, loadActor, type Actor } from "@/lib/auth/actor";
import { getPatientScope, scopeAllowsPatient } from "@/lib/patients";
import type { Result } from "@/lib/visits";
import {
  RESTRICTED_ROLE_KEYS,
  UNRESTRICTED_CATEGORY_KEYS,
  categoryLabel,
  grantExpiry,
  isGrantDuration,
  isRestrictedCategory,
} from "@/lib/document-constants";

const NO_PATIENT_ACCESS = "You do not have access to that patient.";
const NOT_FOUND_DOCUMENT = "That document could not be found.";
const NOT_FOUND_SHARE = "That share could not be found.";
const NOT_ALLOWED_PERSON =
  "That person cannot be given access to this patient's restricted documents.";

// ---------- The two questions documents.ts asks ----------

// Does this person hold one of the administrator roles, the ones that see
// restricted documents without needing a share?
export async function holdsRestrictedRole(userId: string): Promise<boolean> {
  const count = await prisma.userRole.count({
    where: { userId, role: { key: { in: [...RESTRICTED_ROLE_KEYS] } } },
  });
  return count > 0;
}

export interface ActiveGrant {
  patientId: string;
  // null means "every restricted document of this patient".
  documentId: string | null;
}

// The shares that let this person look right now: not taken back, not
// past their end time, and made inside their own organization.
export async function getActiveGrantsFor(
  userId: string,
  organizationId: string,
  now: Date = new Date(),
): Promise<ActiveGrant[]> {
  const rows = await prisma.documentAccessGrant.findMany({
    where: {
      granteeId: userId,
      organizationId,
      revokedAt: null,
      OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
    },
    select: { patientId: true, documentId: true },
  });
  return rows;
}

// Does any of these shares cover this document? Pure, so it can be tested
// on its own.
export function grantsCover(
  grants: readonly ActiveGrant[],
  doc: { id: string; patientId: string },
): boolean {
  return grants.some((g) =>
    g.documentId === null
      ? g.patientId === doc.patientId
      : g.documentId === doc.id && g.patientId === doc.patientId,
  );
}

// ---------- Who may manage shares ----------

// Permission first (a hard stop that throws and is audited), then the
// second lock: you must be an administrator role yourself. Returns the
// actor, or null (already audited) when the second lock fails.
async function requireShareManager(userId: string): Promise<Actor | null> {
  await requirePermission(userId, "documents.grant");
  const actor = await loadActor(userId);
  if (!(await holdsRestrictedRole(userId))) {
    await auditDenied(actor, "document_access_grant");
    return null;
  }
  return actor;
}

// ---------- Reading ----------

export interface ShareRow {
  id: string;
  patientId: string;
  patientName: string;
  documentId: string | null;
  documentTitle: string | null;
  granteeId: string;
  granteeName: string;
  grantedByName: string;
  createdAt: Date;
  expiresAt: Date | null;
}

// Every share that is still in force. Throws AuthorizationError for anyone
// who may not manage shares, so a page can show a plain "no access".
export async function listShares(userId: string): Promise<ShareRow[]> {
  const actor = await requireShareManager(userId);
  if (!actor) throw new AuthorizationError("documents.grant");

  const rows = await prisma.documentAccessGrant.findMany({
    where: {
      organizationId: actor.organizationId,
      revokedAt: null,
      OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
    },
    select: {
      id: true,
      patientId: true,
      documentId: true,
      granteeId: true,
      createdAt: true,
      expiresAt: true,
      patient: { select: { firstName: true, lastName: true } },
      document: { select: { title: true } },
      grantee: { select: { name: true } },
      grantedBy: { select: { name: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  return rows.map((g) => ({
    id: g.id,
    patientId: g.patientId,
    patientName: `${g.patient.firstName} ${g.patient.lastName}`,
    documentId: g.documentId,
    documentTitle: g.document?.title ?? null,
    granteeId: g.granteeId,
    granteeName: g.grantee.name,
    grantedByName: g.grantedBy.name,
    createdAt: g.createdAt,
    expiresAt: g.expiresAt,
  }));
}

export interface ShareOptions {
  patients: {
    patientId: string;
    patientName: string;
    documents: { id: string; title: string; categoryLabel: string }[];
  }[];
  people: {
    id: string;
    name: string;
    roleLabel: string;
    // "all" for someone who reaches every patient, otherwise the patients
    // they reach. The form only offers people who reach the chosen patient.
    reach: "all" | string[];
  }[];
}

// What the sharing form may offer. null for anyone who may not share, so
// the page leaves the form out. (The form being absent is a convenience;
// createShare is what enforces it.)
export async function getShareOptions(userId: string): Promise<ShareOptions | null> {
  if (!(await hasPermission(userId, "documents.grant"))) return null;
  if (!(await holdsRestrictedRole(userId))) return null;
  const actor = await loadActor(userId);

  const [patients, restrictedDocs, candidates] = await Promise.all([
    prisma.patient.findMany({
      where: { organizationId: actor.organizationId },
      select: { id: true, firstName: true, lastName: true },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    }),
    prisma.document.findMany({
      where: {
        organizationId: actor.organizationId,
        status: "active",
        category: { notIn: UNRESTRICTED_CATEGORY_KEYS },
      },
      select: { id: true, patientId: true, title: true, category: true },
      orderBy: { createdAt: "desc" },
    }),
    prisma.user.findMany({
      where: {
        organizationId: actor.organizationId,
        userRoles: {
          some: { role: { rolePermissions: { some: { permission: { key: "documents.read" } } } } },
        },
        NOT: { userRoles: { some: { role: { key: { in: [...RESTRICTED_ROLE_KEYS] } } } } },
      },
      select: { id: true, name: true, userRoles: { select: { role: { select: { name: true } } } } },
      orderBy: { name: "asc" },
      take: 100,
    }),
  ]);

  const people = await Promise.all(
    candidates.map(async (u) => {
      const scope = await getPatientScope(u.id);
      return {
        id: u.id,
        name: u.name,
        roleLabel: u.userRoles.map((ur) => ur.role.name).join(", "),
        reach: scope.kind === "organization" ? ("all" as const) : scope.patientIds,
      };
    }),
  );

  return {
    patients: patients.map((p) => ({
      patientId: p.id,
      patientName: `${p.firstName} ${p.lastName}`,
      documents: restrictedDocs
        .filter((d) => d.patientId === p.id)
        .map((d) => ({ id: d.id, title: d.title, categoryLabel: categoryLabel(d.category) })),
    })),
    people,
  };
}

// ---------- Sharing ----------

export interface CreateShareInput {
  patientId: string;
  // Empty or missing means "every restricted document of this patient".
  documentId?: string;
  granteeId: string;
  duration: string;
}

export async function createShare(
  userId: string,
  input: CreateShareInput,
): Promise<Result<{ grantId: string }>> {
  // 1 and 2. Permission (a hard stop), then be an administrator role.
  const actor = await requireShareManager(userId);
  if (!actor) return { ok: false, error: "You do not have permission to do that." };

  // 3. The patient must be one the administrator can reach.
  const scope = await getPatientScope(userId);
  if (!(await scopeAllowsPatient(scope, input.patientId))) {
    await auditDenied(actor, "patient", input.patientId);
    return { ok: false, error: NO_PATIENT_ACCESS };
  }

  // 4. How long it lasts.
  if (!isGrantDuration(input.duration)) {
    return { ok: false, error: "Choose how long the access lasts." };
  }

  // 5. If one document was chosen, it must be an active, restricted
  //    document of THIS patient. Anything else looks like "not found".
  const documentId = input.documentId && input.documentId.length > 0 ? input.documentId : null;
  if (documentId !== null) {
    const doc = await prisma.document.findUnique({
      where: { id: documentId },
      select: { organizationId: true, patientId: true, status: true, category: true },
    });
    const valid =
      doc !== null &&
      doc.organizationId === actor.organizationId &&
      doc.patientId === input.patientId &&
      doc.status === "active" &&
      isRestrictedCategory(doc.category);
    if (!valid) {
      await auditDenied(actor, "document", documentId);
      return { ok: false, error: NOT_FOUND_DOCUMENT };
    }
  }

  // 6. The person. Made-up, from another organization, holding no
  //    document permission, already an administrator, or unable to reach
  //    this patient: all the same words.
  const grantee = await prisma.user.findFirst({
    where: { id: input.granteeId, organizationId: actor.organizationId },
    select: { id: true },
  });
  const eligible =
    grantee !== null &&
    (await hasPermission(grantee.id, "documents.read")) &&
    !(await holdsRestrictedRole(grantee.id)) &&
    (await scopeAllowsPatient(await getPatientScope(grantee.id), input.patientId));
  if (!eligible) {
    await auditDenied(actor, "document_access_grant", input.granteeId);
    return { ok: false, error: NOT_ALLOWED_PERSON };
  }

  // 7. Not the same share twice.
  const now = new Date();
  const existing = await prisma.documentAccessGrant.findFirst({
    where: {
      organizationId: actor.organizationId,
      granteeId: input.granteeId,
      patientId: input.patientId,
      documentId,
      revokedAt: null,
      OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
    },
    select: { id: true },
  });
  if (existing) {
    return { ok: false, error: "That person already has this access." };
  }

  const created = await prisma.documentAccessGrant.create({
    data: {
      organizationId: actor.organizationId,
      patientId: input.patientId,
      documentId,
      granteeId: input.granteeId,
      grantedById: userId,
      expiresAt: grantExpiry(input.duration, now),
    },
    select: { id: true },
  });

  await auditAllowed(actor, "document_access_granted", "document_access_grant", created.id);
  return { ok: true, value: { grantId: created.id } };
}

// ---------- Taking it back ----------

export async function revokeShare(
  userId: string,
  grantId: string,
): Promise<Result<{ grantId: string }>> {
  const actor = await requireShareManager(userId);
  if (!actor) return { ok: false, error: "You do not have permission to do that." };

  const grant = await prisma.documentAccessGrant.findUnique({
    where: { id: grantId },
    select: { id: true, organizationId: true },
  });
  if (!grant || grant.organizationId !== actor.organizationId) {
    await auditDenied(actor, "document_access_grant", grantId);
    return { ok: false, error: NOT_FOUND_SHARE };
  }

  // The expected state in the WHERE clause makes this safe if two people
  // click at the same moment.
  const result = await prisma.documentAccessGrant.updateMany({
    where: { id: grant.id, revokedAt: null },
    data: { revokedAt: new Date(), revokedById: userId },
  });
  if (result.count === 0) {
    return { ok: false, error: "That share was already taken back." };
  }

  await auditAllowed(actor, "document_access_revoked", "document_access_grant", grant.id);
  return { ok: true, value: { grantId: grant.id } };
}
