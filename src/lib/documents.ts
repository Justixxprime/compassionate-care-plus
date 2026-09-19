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
//                   RESTRICTED: only administrative roles (the
//                   "organization" scope) may see or download them, and
//                   only they may file one. A nurse on the care team
//                   sees the clinical paperwork and nothing else.
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
import { writeAuditLog } from "@/lib/audit/log";
import {
  getPatientScope,
  scopeAllowsPatient,
  type PatientScope,
} from "@/lib/patients";
import type { Result } from "@/lib/visits";
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

const NOT_FOUND = "That document could not be found.";
const NO_PATIENT_ACCESS = "You do not have access to that patient.";
const NO_CATEGORY_ACCESS = "You cannot file that kind of document.";

interface Actor {
  id: string;
  email: string;
  organizationId: string;
}

async function loadActor(userId: string): Promise<Actor> {
  return prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: { id: true, email: true, organizationId: true },
  });
}

async function auditDenied(
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

async function auditAllowed(
  actor: Actor,
  action: string,
  resourceId: string,
): Promise<void> {
  await writeAuditLog({
    actorUserId: actor.id,
    actorEmail: actor.email,
    action,
    resourceType: "document",
    resourceId,
    outcome: "allowed",
  });
}

// The third question. Only the organization-wide (administrative) scope
// may touch a restricted category.
function scopeMayUseCategory(scope: PatientScope, category: string): boolean {
  return !isRestrictedCategory(category) || scope.kind === "organization";
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
      fileName: true,
      contentType: true,
    },
  });

  const visible =
    doc !== null &&
    doc.organizationId === actor.organizationId &&
    doc.status === "active" &&
    (await scopeAllowsPatient(scope, doc.patientId)) &&
    scopeMayUseCategory(scope, doc.category);

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

  const scope = await getPatientScope(userId);
  const canArchive = await hasPermission(userId, "documents.delete");

  const rows = await prisma.document.findMany({
    where: {
      organizationId: scope.organizationId,
      status: "active",
      ...(scope.kind === "organization"
        ? {}
        : {
            patientId: { in: scope.patientIds },
            // Restricted categories are never even fetched for a
            // clinical account.
            category: { in: UNRESTRICTED_CATEGORY_KEYS },
          }),
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
      scopeMayUseCategory(scope, c.key),
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
  if (!scopeMayUseCategory(scope, input.category)) {
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
    where: { patientId: input.patientId, sha256, status: "active" },
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

  await auditAllowed(actor, "document_uploaded", created.id);
  return { ok: true, value: { documentId: created.id } };
}

// ---------- Downloading ----------

export interface DownloadableDocument {
  fileName: string;
  contentType: string;
  bytes: Uint8Array;
}

export async function getDocumentForDownload(
  userId: string,
  documentId: string,
): Promise<Result<DownloadableDocument>> {
  await requirePermission(userId, "documents.read");

  const actor = await loadActor(userId);
  const scope = await getPatientScope(userId);

  const doc = await loadVisibleDocument(actor, scope, documentId);
  if (!doc) return { ok: false, error: NOT_FOUND };

  // The bytes are fetched on purpose, only now, after every check.
  const file = await prisma.documentFile.findUnique({
    where: { documentId: doc.id },
    select: { data: true },
  });
  if (!file) return { ok: false, error: NOT_FOUND };

  await auditAllowed(actor, "document_downloaded", doc.id);
  return {
    ok: true,
    value: {
      fileName: doc.fileName,
      contentType: doc.contentType,
      bytes: file.data,
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

  const doc = await loadVisibleDocument(actor, scope, documentId);
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

  await auditAllowed(actor, "document_archived", doc.id);
  return { ok: true, value: { documentId: doc.id } };
}
