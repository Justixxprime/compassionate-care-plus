// src/lib/documents.ts
//
// Everything about who may see, file, download and archive a document
// lives in this one file. Pages, the download route and server actions
// call these functions; none of them query the document tables or decide
// access on their own.
//
// A document is a FILE, and files are the most sensitive thing here
// after the clinical record. So on top of permission and relationship
// (the two questions patients and visits ask), documents ask a third
// question that care plans did not: WHAT KIND of document is it?
//
//   1. PERMISSION   documents.read / .upload / .delete
//                   (requirePermission, a hard stop)
//   2. RELATIONSHIP can this person reach the patient at all?
//                   (getPatientScope in src/lib/patients.ts - the same
//                   code every slice uses, not a copy)
//   3. CATEGORY     insurance and identification documents are
//                   RESTRICTED. By default only the two administrator
//                   roles (SUPER_ADMIN and ADMIN) may see, download or
//                   file them. Anyone else who reaches the patient sees a
//                   restricted document only if an administrator has
//                   SHARED it with them on purpose, for one patient or
//                   one document, for as long as the administrator chose
//                   (src/lib/document-grants.ts). A share is permission
//                   to look and download, never to file or archive. A
//                   nurse on the care team sees the clinical paperwork
//                   and nothing else, unless something is shared.
//
// Why no "on the care team" question here, unlike care plans: filing
// paperwork (a consent, an insurance card) is an office job that
// administrative staff do for patients they are not caring for. What
// needed the team question was WRITING clinical judgment. Documents are
// controlled by kind instead.
//
// Other rules:
//   - the type of a file is worked out from its own bytes; anything that
//     is not a real PDF, PNG or JPEG is refused, whatever it is called
//   - 2 MB at most, never empty
//   - the same file cannot be filed twice for the same patient
//   - only active patients get new documents
//   - archiving needs documents.delete (SUPER_ADMIN only today), and an
//     archived document is hidden from every list and download but kept
//   - documents are never hard-deleted
//
// What a denial does: it is written to the audit log (action
// "access_denied", outcome "denied") and the caller gets a plain
// message. A document that does not exist, one in another patient's
// file, and one in a restricted category all produce the SAME answer, so
// nobody can learn that a restricted document exists by asking for it.
//
// Downloads are logged ("document_downloaded"). This is the first place
// in the project where READING is audited, because opening a file is the
// event an investigation would ask about. The log records that it
// happened, never what the file contained.
//
// Where the bytes live is this file's business alone. Today they sit in
// the database (free, testable on one machine). Moving them to encrypted
// object storage later changes uploadDocument, getDocumentForDownload
// and nothing else.

import "server-only";
import { createHash } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { hasPermission, requirePermission } from "@/lib/auth/authorize";
import { auditAllowed, auditDenied, loadActor, type Actor } from "@/lib/auth/actor";
import {
  getPatientScope,
  scopeAllowsPatient,
  type PatientScope,
} from "@/lib/patients";
import type { Result } from "@/lib/visits";
import type { Prisma } from "@prisma/client";
import {
  getActiveGrantsFor,
  grantsCover,
  holdsRestrictedRole,
  type ActiveGrant,
} from "@/lib/document-grants";
import {
  DOCUMENT_CATEGORIES,
  MAX_DOCUMENT_BYTES,
  TITLE_MAX,
  UNRESTRICTED_CATEGORY_KEYS,
  categoryLabel,
  detectContentType,
  isDocumentCategory,
  isRestrictedCategory,
  safeFileName,
} from "@/lib/document-constants";
import { getDemoDocument } from "@/lib/r2-document-storage";

const NOT_FOUND = "That document could not be found.";
const NO_PATIENT_ACCESS = "You do not have access to that patient.";
const NO_CATEGORY_ACCESS = "You cannot file that kind of document.";

// The third question, asked in two forms.
//
// What this person's restricted access is: either their ROLE gives it
// (SUPER_ADMIN, ADMIN) or they hold shares an administrator made for them.
interface RestrictedAccess {
  byRole: boolean;
  grants: ActiveGrant[];
}

async function getRestrictedAccess(actor: Actor): Promise<RestrictedAccess> {
  const byRole = await holdsRestrictedRole(actor.id);
  // An administrator role needs no shares, so none are fetched.
  const grants = byRole ? [] : await getActiveGrantsFor(actor.id, actor.organizationId);
  return { byRole, grants };
}

// May this person SEE or DOWNLOAD this document? An unrestricted one: yes
// (reach was already checked). A restricted one: only by role, or when a
// share covers it.
function mayViewDocument(
  access: RestrictedAccess,
  doc: { id: string; patientId: string; category: string },
): boolean {
  if (!isRestrictedCategory(doc.category)) return true;
  return access.byRole || grantsCover(access.grants, doc);
}

// May this person FILE a document of this kind? A restricted kind needs an
// administrator role AND organization-wide reach. A share never lets
// anyone file.
function mayFileCategory(
  access: RestrictedAccess,
  scope: PatientScope,
  category: string,
): boolean {
  return !isRestrictedCategory(category) || (access.byRole && scope.kind === "organization");
}

function cleanTitle(value: string): string {
  return value.replace(/\u0000/g, "").trim();
}

// Finds a document AND checks the person may reach it: right
// organization, still active, patient within reach, category allowed.
// Every way of failing that ends the same way: audited, and null.
async function loadVisibleDocument(
  actor: Actor,
  scope: PatientScope,
  access: RestrictedAccess,
  documentId: string,
) {
  const doc = await prisma.document.findUnique({
    where: { id: documentId },
    select: {
      id: true,
      organizationId: true,
      patientId: true,
      category: true,
      status: true,
      scanStatus: true,
      storageKind: true,
      storageKey: true,
      fileName: true,
      contentType: true,
    },
  });

  const visible =
    doc !== null &&
    doc.organizationId === actor.organizationId &&
    doc.status === "active" &&
    doc.scanStatus === "clean" &&
    (await scopeAllowsPatient(scope, doc.patientId)) &&
    mayViewDocument(access, doc);

  if (!doc || !visible) {
    await auditDenied(actor, "document", documentId);
    return null;
  }
  return doc;
}

// ---------- Reading ----------

export interface DocumentRow {
  id: string;
  patientId: string;
  patientName: string;
  category: string;
  categoryLabel: string;
  restricted: boolean;
  // A restricted document this person sees only because an administrator
  // shared it with them.
  sharedWithYou: boolean;
  title: string;
  fileName: string;
  contentType: string;
  sizeBytes: number;
  uploadedByName: string;
  createdAt: Date;
  canArchive: boolean; // what THIS viewer may do; archiveDocument re-checks
}

const LIST_LIMIT = 200;

export async function listDocuments(userId: string): Promise<DocumentRow[]> {
  await requirePermission(userId, "documents.read");

  const actor = await loadActor(userId);
  const scope = await getPatientScope(userId);
  const access = await getRestrictedAccess(actor);
  const canArchive = await hasPermission(userId, "documents.delete");

  // Who may see a restricted document, decided IN the query so a
  // restricted row that the person may not see is never even fetched:
  //   administrator role: no extra limit
  //   anyone else: the unrestricted kinds, plus exactly what was shared
  const visibility: Prisma.DocumentWhereInput = access.byRole
    ? {}
    : {
        OR: [
          { category: { in: UNRESTRICTED_CATEGORY_KEYS } },
          ...access.grants.map((g) =>
            g.documentId ? { id: g.documentId } : { patientId: g.patientId },
          ),
        ],
      };

  const rows = await prisma.document.findMany({
    where: {
      organizationId: scope.organizationId,
      status: "active",
      scanStatus: "clean",
      ...(scope.kind === "organization" ? {} : { patientId: { in: scope.patientIds } }),
      ...visibility,
    },
    select: {
      id: true,
      patientId: true,
      category: true,
      title: true,
      fileName: true,
      contentType: true,
      sizeBytes: true,
      createdAt: true,
      patient: { select: { firstName: true, lastName: true } },
      uploadedBy: { select: { name: true } },
    },
    orderBy: { createdAt: "desc" },
    take: LIST_LIMIT,
  });

  return rows.map((d) => ({
    id: d.id,
    patientId: d.patientId,
    patientName: `${d.patient.firstName} ${d.patient.lastName}`,
    category: d.category,
    categoryLabel: categoryLabel(d.category),
    restricted: isRestrictedCategory(d.category),
    sharedWithYou: isRestrictedCategory(d.category) && !access.byRole,
    title: d.title,
    fileName: d.fileName,
    contentType: d.contentType,
    sizeBytes: d.sizeBytes,
    uploadedByName: d.uploadedBy.name,
    createdAt: d.createdAt,
    canArchive,
  }));
}

// ---------- Options for the upload form ----------

export interface DocumentUploadOptions {
  patients: { patientId: string; patientName: string }[];
  categories: { key: string; label: string }[];
}

// What THIS person may file: which patients, and which kinds of
// document. Returns null when they cannot upload at all so the page can
// leave the form out. (The form being absent is convenience -
// uploadDocument is what enforces it.)
export async function getDocumentUploadOptions(
  userId: string,
): Promise<DocumentUploadOptions | null> {
  if (!(await hasPermission(userId, "documents.upload"))) return null;

  const scope = await getPatientScope(userId);
  const access = await getRestrictedAccess(await loadActor(userId));

  const patients = await prisma.patient.findMany({
    where: {
      organizationId: scope.organizationId,
      status: "active",
      ...(scope.kind === "organization" ? {} : { id: { in: scope.patientIds } }),
    },
    select: { id: true, firstName: true, lastName: true },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
  });

  return {
    patients: patients.map((p) => ({
      patientId: p.id,
      patientName: `${p.firstName} ${p.lastName}`,
    })),
    categories: DOCUMENT_CATEGORIES.filter((c) =>
      mayFileCategory(access, scope, c.key),
    ).map((c) => ({ key: c.key, label: c.label })),
  };
}

// ---------- Filing a document ----------

export interface UploadDocumentInput {
  patientId: string;
  category: string;
  title: string;
  fileName: string;
  bytes: Uint8Array;
}

export async function uploadDocument(
  userId: string,
  input: UploadDocumentInput,
): Promise<Result<{ documentId: string }>> {
  // 1. Permission - a hard stop, throws AuthorizationError.
  await requirePermission(userId, "documents.upload");

  const actor = await loadActor(userId);
  const scope = await getPatientScope(userId);
  const access = await getRestrictedAccess(actor);

  // 2. Relationship to the patient.
  if (!(await scopeAllowsPatient(scope, input.patientId))) {
    await auditDenied(actor, "patient", input.patientId);
    return { ok: false, error: NO_PATIENT_ACCESS };
  }

  // 3. Category: an unknown category is refused; a restricted one needs
  //    an administrative role.
  if (!isDocumentCategory(input.category)) {
    return { ok: false, error: "Choose what kind of document this is." };
  }
  if (!mayFileCategory(access, scope, input.category)) {
    await auditDenied(actor, "patient", input.patientId);
    return { ok: false, error: NO_CATEGORY_ACCESS };
  }

  // 4. The details.
  const title = cleanTitle(input.title);
  if (title.length === 0) return { ok: false, error: "Give the document a title." };
  if (title.length > TITLE_MAX) {
    return { ok: false, error: `The title can be at most ${TITLE_MAX} characters.` };
  }

  if (input.bytes.length === 0) {
    return { ok: false, error: "That file is empty." };
  }
  if (input.bytes.length > MAX_DOCUMENT_BYTES) {
    return {
      ok: false,
      error: `That file is too large. The limit is ${Math.round(MAX_DOCUMENT_BYTES / (1024 * 1024))} MB.`,
    };
  }

  const contentType = detectContentType(input.bytes);
  if (!contentType) {
    return { ok: false, error: "Only PDF, PNG and JPEG files can be filed." };
  }

  const patient = await prisma.patient.findFirst({
    where: { id: input.patientId, organizationId: actor.organizationId },
    select: { status: true },
  });
  if (!patient || patient.status !== "active") {
    return {
      ok: false,
      error: "A document can only be filed for an active patient.",
    };
  }

  const sha256 = createHash("sha256").update(input.bytes).digest("hex");
  const duplicate = await prisma.document.findFirst({
    where: { patientId: input.patientId, sha256, status: "active", scanStatus: "clean" },
    select: { id: true },
  });
  if (duplicate) {
    return {
      ok: false,
      error: "This exact file is already on file for this patient.",
    };
  }

  const created = await prisma.document.create({
    data: {
      organizationId: actor.organizationId,
      patientId: input.patientId,
      uploadedById: userId,
      category: input.category,
      title,
      fileName: safeFileName(input.fileName, contentType),
      contentType,
      sizeBytes: input.bytes.length,
      sha256,
      file: { create: { data: Buffer.from(input.bytes) } },
    },
    select: { id: true },
  });

  await auditAllowed(actor, "document_uploaded", "document", created.id);
  return { ok: true, value: { documentId: created.id } };
}

// ---------- Downloading ----------

export interface DownloadableDocument {
  fileName: string;
  contentType: string;
  bytes: Uint8Array;
}

// Only call this after the caller completed every access check. R2 object
// keys are opaque and private; this function never produces a public URL.
export async function readDocumentBytes(doc: {
  id: string;
  storageKind: string;
  storageKey: string | null;
}): Promise<Uint8Array | null> {
  if (doc.storageKind === "r2") {
    return doc.storageKey ? getDemoDocument(doc.storageKey) : null;
  }
  const file = await prisma.documentFile.findUnique({
    where: { documentId: doc.id }, select: { data: true },
  });
  return file?.data ?? null;
}

export async function getDocumentForDownload(
  userId: string,
  documentId: string,
): Promise<Result<DownloadableDocument>> {
  await requirePermission(userId, "documents.read");

  const actor = await loadActor(userId);
  const scope = await getPatientScope(userId);
  const access = await getRestrictedAccess(actor);

  const doc = await loadVisibleDocument(actor, scope, access, documentId);
  if (!doc) return { ok: false, error: NOT_FOUND };

  const bytes = await readDocumentBytes(doc);
  if (!bytes) return { ok: false, error: NOT_FOUND };

  await auditAllowed(actor, "document_downloaded", "document", doc.id);
  return {
    ok: true,
    value: {
      fileName: doc.fileName,
      contentType: doc.contentType,
      bytes,
    },
  };
}

// ---------- Archiving ----------

export async function archiveDocument(
  userId: string,
  documentId: string,
): Promise<Result<{ documentId: string }>> {
  // Archiving needs its own permission: documents.delete. A nurse who
  // filed the wrong file cannot remove it; an administrator can.
  await requirePermission(userId, "documents.delete");

  const actor = await loadActor(userId);
  const scope = await getPatientScope(userId);
  const access = await getRestrictedAccess(actor);

  const doc = await loadVisibleDocument(actor, scope, access, documentId);
  if (!doc) return { ok: false, error: NOT_FOUND };

  // The expected status in the WHERE clause makes this safe if two
  // people click at the same moment.
  const result = await prisma.document.updateMany({
    where: { id: doc.id, status: "active" },
    data: { status: "archived", archivedAt: new Date(), archivedById: userId },
  });
  if (result.count === 0) {
    return { ok: false, error: "That document was just archived by someone else." };
  }

  await auditAllowed(actor, "document_archived", "document", doc.id);
  return { ok: true, value: { documentId: doc.id } };
}
