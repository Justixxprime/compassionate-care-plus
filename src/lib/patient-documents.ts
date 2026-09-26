import "server-only";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/auth/authorize";
import { auditAllowed, auditDenied, loadActor } from "@/lib/auth/actor";
import { PORTAL_STATUSES } from "@/lib/patient-portal";
import { categoryLabel } from "@/lib/document-constants";

const NOT_FOUND = "That document could not be found.";

async function ownedPatient(userId: string) {
  const actor = await loadActor(userId);
  const patient = await prisma.patient.findFirst({
    where: { userId, organizationId: actor.organizationId, status: { in: PORTAL_STATUSES } },
    select: { id: true },
  });
  return { actor, patient };
}

export interface MyDocument {
  id: string;
  title: string;
  categoryLabel: string;
  fileName: string;
  sizeBytes: number;
  createdAt: Date;
}

export async function listMyDocuments(userId: string): Promise<MyDocument[] | null> {
  await requirePermission(userId, "portal.documents.read");
  const { actor, patient } = await ownedPatient(userId);
  if (!patient) return null;
  const rows = await prisma.document.findMany({
    where: { organizationId: actor.organizationId, patientId: patient.id, status: "active" },
    select: { id: true, title: true, category: true, fileName: true, sizeBytes: true, createdAt: true },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  return rows.map((row) => ({ ...row, categoryLabel: categoryLabel(row.category) }));
}

export async function getMyDocumentForDownload(userId: string, documentId: string) {
  await requirePermission(userId, "portal.documents.read");
  const { actor, patient } = await ownedPatient(userId);
  const doc = patient ? await prisma.document.findFirst({
    where: { id: documentId, organizationId: actor.organizationId, patientId: patient.id, status: "active" },
    select: { id: true, fileName: true, contentType: true },
  }) : null;
  if (!doc) {
    await auditDenied(actor, "document", documentId);
    return { ok: false as const, error: NOT_FOUND };
  }
  const file = await prisma.documentFile.findUnique({ where: { documentId: doc.id }, select: { data: true } });
  if (!file) return { ok: false as const, error: NOT_FOUND };
  await auditAllowed(actor, "document_downloaded", "document", doc.id);
  return { ok: true as const, value: { ...doc, bytes: file.data } };
}
