import "server-only";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/auth/authorize";
import { auditDenied, loadActor } from "@/lib/auth/actor";
import { activeAssignmentFilter, getPatientScope, scopeAllowsPatient } from "@/lib/patients";
import { notifyUser } from "@/lib/notifications";

const NOT_FOUND = "That conversation could not be found.";
export const MESSAGE_MAX = 2000;
type Result<T> = { ok: true; value: T } | { ok: false; error: string };

async function getAccessiblePatient(userId: string, patientId: string) {
  const actor = await loadActor(userId);
  const ownPatient = await prisma.patient.findFirst({ where: { id: patientId, userId, organizationId: actor.organizationId, status: { in: ["active", "on_hold"] } }, select: { id: true } });
  if (ownPatient) return { actor, patientId };
  const scope = await getPatientScope(userId);
  if (!(await scopeAllowsPatient(scope, patientId))) {
    await auditDenied(actor, "message_thread", patientId);
    return null;
  }
  return { actor, patientId };
}

async function markThreadRead(threadId: string, userId: string) {
  await prisma.messageReadState.upsert({
    where: { threadId_userId: { threadId, userId } },
    update: { lastReadAt: new Date() },
    create: { threadId, userId, lastReadAt: new Date() },
  });
}

export async function getSecureMessages(userId: string, patientId: string) {
  await requirePermission(userId, "messages.read");
  const access = await getAccessiblePatient(userId, patientId);
  if (!access) return null;
  const patient = await prisma.patient.findFirst({
    where: { id: patientId, organizationId: access.actor.organizationId },
    select: { firstName: true, lastName: true },
  });
  if (!patient) return null;
  const thread = await prisma.messageThread.findFirst({
    where: { patientId, organizationId: access.actor.organizationId },
    include: { messages: { include: { sender: { select: { name: true } } }, orderBy: { createdAt: "asc" }, take: 200 } },
  });
  if (!thread) return { patientName: `${patient.firstName} ${patient.lastName}`, messages: [] };
  await markThreadRead(thread.id, userId);
  return { patientName: `${patient.firstName} ${patient.lastName}`, messages: thread.messages.map((message) => ({ id: message.id, body: message.body, senderName: message.sender.name, mine: message.senderId === userId, createdAt: message.createdAt })) };
}

export async function listSecureMessagePatients(userId: string) {
  await requirePermission(userId, "messages.read");
  const actor = await loadActor(userId);
  const scope = await getPatientScope(userId);
  const patients = await prisma.patient.findMany({
    where: scope.kind === "organization" ? { organizationId: actor.organizationId, status: { in: ["active", "on_hold"] } } : { organizationId: actor.organizationId, id: { in: scope.patientIds }, status: { in: ["active", "on_hold"] } },
    select: { id: true, firstName: true, lastName: true, messageThread: { select: { id: true } } },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
  });
  return Promise.all(patients.map(async (patient) => {
    if (!patient.messageThread) return { id: patient.id, name: `${patient.firstName} ${patient.lastName}`, lastMessageAt: null, unreadCount: 0 };
    const state = await prisma.messageReadState.findUnique({ where: { threadId_userId: { threadId: patient.messageThread.id, userId } }, select: { lastReadAt: true } });
    const [latest, unreadCount] = await Promise.all([
      prisma.message.findFirst({ where: { threadId: patient.messageThread.id }, orderBy: { createdAt: "desc" }, select: { createdAt: true } }),
      prisma.message.count({ where: { threadId: patient.messageThread.id, senderId: { not: userId }, ...(state ? { createdAt: { gt: state.lastReadAt } } : {}) } }),
    ]);
    return { id: patient.id, name: `${patient.firstName} ${patient.lastName}`, lastMessageAt: latest?.createdAt ?? null, unreadCount };
  }));
}

export async function sendSecureMessage(userId: string, patientId: string, raw: string): Promise<Result<{ id: string }>> {
  await requirePermission(userId, "messages.send");
  const access = await getAccessiblePatient(userId, patientId);
  if (!access) return { ok: false, error: NOT_FOUND };
  const body = raw.trim();
  if (!body || body.length > MESSAGE_MAX) return { ok: false, error: `Write a message of up to ${MESSAGE_MAX} characters.` };
  const thread = await prisma.messageThread.upsert({ where: { patientId }, update: {}, create: { patientId, organizationId: access.actor.organizationId } });
  const message = await prisma.message.create({ data: { threadId: thread.id, senderId: userId, body } });
  await markThreadRead(thread.id, userId);
  const patient = await prisma.patient.findUnique({ where: { id: patientId }, select: { userId: true } });
  const recipients = patient?.userId === userId
    ? await prisma.careTeamMember.findMany({ where: { patientId, ...activeAssignmentFilter() }, select: { userId: true } })
    : patient?.userId ? [{ userId: patient.userId }] : [];
  await Promise.all(recipients.filter((recipient) => recipient.userId !== userId).map((recipient) => notifyUser({ organizationId: access.actor.organizationId, userId: recipient.userId, kind: "message_received", resourceType: "message_thread", resourceId: patientId })));
  return { ok: true, value: { id: message.id } };
}
