import "server-only";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/auth/authorize";
import { auditDenied, loadActor } from "@/lib/auth/actor";
import { getPatientScope, scopeAllowsPatient } from "@/lib/patients";

const NOT_FOUND = "That conversation could not be found.";
export const MESSAGE_MAX = 2000;
type Result<T> = { ok: true; value: T } | { ok: false; error: string };

async function accessiblePatient(userId: string, patientId: string) {
  const actor = await loadActor(userId);
  const own = await prisma.patient.findFirst({ where: { id: patientId, userId, organizationId: actor.organizationId, status: { in: ["active", "on_hold"] } }, select: { id: true } });
  if (own) return { actor, patientId };
  const scope = await getPatientScope(userId);
  if (!(await scopeAllowsPatient(scope, patientId))) { await auditDenied(actor, "message_thread", patientId); return null; }
  return { actor, patientId };
}

export async function getSecureMessages(userId: string, patientId: string) {
  await requirePermission(userId, "messages.read");
  const access = await accessiblePatient(userId, patientId);
  if (!access) return null;
  const thread = await prisma.messageThread.findFirst({ where: { patientId, organizationId: access.actor.organizationId }, include: { messages: { include: { sender: { select: { name: true } } }, orderBy: { createdAt: "asc" }, take: 200 }, patient: { select: { firstName: true, lastName: true } } } });
  return { patientName: thread ? `${thread.patient.firstName} ${thread.patient.lastName}` : "", messages: thread?.messages.map((m) => ({ id: m.id, body: m.body, senderName: m.sender.name, mine: m.senderId === userId, createdAt: m.createdAt })) ?? [] };
}

// The staff inbox contains only patients the current account can reach.
// A patient account never uses this list: it receives its one linked record
// from getMyCare(), so changing a browser value cannot reveal another person.
export async function listSecureMessagePatients(userId: string) {
  await requirePermission(userId, "messages.read");
  const actor = await loadActor(userId);
  const scope = await getPatientScope(userId);
  return prisma.patient.findMany({
    where: scope.kind === "organization"
      ? { organizationId: actor.organizationId, status: { in: ["active", "on_hold"] } }
      : { organizationId: actor.organizationId, id: { in: scope.patientIds }, status: { in: ["active", "on_hold"] } },
    select: { id: true, firstName: true, lastName: true, messageThread: { select: { messages: { orderBy: { createdAt: "desc" }, take: 1, select: { createdAt: true } } } } },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
  }).then(rows => rows.map(p => ({ id: p.id, name: `${p.firstName} ${p.lastName}`, lastMessageAt: p.messageThread?.messages[0]?.createdAt ?? null })));
}

export async function sendSecureMessage(userId: string, patientId: string, raw: string): Promise<Result<{ id: string }>> {
  await requirePermission(userId, "messages.send");
  const access = await accessiblePatient(userId, patientId);
  if (!access) return { ok: false, error: NOT_FOUND };
  const body = raw.trim();
  if (!body || body.length > MESSAGE_MAX) return { ok: false, error: `Write a message of up to ${MESSAGE_MAX} characters.` };
  const thread = await prisma.messageThread.upsert({ where: { patientId }, update: {}, create: { patientId, organizationId: access.actor.organizationId } });
  const message = await prisma.message.create({ data: { threadId: thread.id, senderId: userId, body } });
  await prisma.messageThread.update({ where: { id: thread.id }, data: {} });
  return { ok: true, value: { id: message.id } };
}
