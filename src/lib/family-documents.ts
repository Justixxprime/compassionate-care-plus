import "server-only";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/auth/authorize";
import { auditAllowed, auditDenied, loadActor } from "@/lib/auth/actor";
import { UNRESTRICTED_CATEGORY_KEYS } from "@/lib/document-constants";
import { readDocumentBytes } from "@/lib/documents";
const NOT_FOUND = "That document could not be found.";
export async function getFamilyDocumentForDownload(userId: string, documentId: string) {
  await requirePermission(userId, "family.read");
  const actor = await loadActor(userId);
  const doc = await prisma.document.findFirst({ where: { id: documentId, organizationId: actor.organizationId, status: "active", scanStatus: "clean", category: { in: UNRESTRICTED_CATEGORY_KEYS }, patient: { status: { in: ["active", "on_hold"] }, familyConsents: { some: { familyUserId: userId, organizationId: actor.organizationId, revokedAt: null, OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }], scopes: { has: "documents" } } } } }, select: { id: true, fileName: true, contentType: true, storageKind: true, storageKey: true } });
  if (!doc) { await auditDenied(actor, "document", documentId); return { ok: false as const, error: NOT_FOUND }; }
  const bytes = await readDocumentBytes(doc);
  if (!bytes) return { ok: false as const, error: NOT_FOUND };
  await auditAllowed(actor, "document_downloaded", "document", doc.id);
  return { ok: true as const, value: { ...doc, bytes } };
}
