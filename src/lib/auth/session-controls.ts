// Self-service session controls. A person may inspect and revoke only their
// own live sessions; the current session is identified from the httpOnly
// cookie, never from a browser-supplied session id.

import "server-only";
import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "@/lib/audit/log";

const SESSION_COOKIE = "ccp_session";

export interface ActiveSessionSummary {
  createdAt: Date;
  expiresAt: Date;
  isCurrent: boolean;
}

export async function listActiveSessions(userId: string): Promise<ActiveSessionSummary[]> {
  const now = new Date();
  await prisma.session.deleteMany({ where: { userId, expiresAt: { lt: now } } });
  const currentSessionId = (await cookies()).get(SESSION_COOKIE)?.value;
  const sessions = await prisma.session.findMany({
    where: { userId, expiresAt: { gte: now } },
    select: { id: true, createdAt: true, expiresAt: true },
    orderBy: { createdAt: "desc" },
  });
  return sessions.map((session) => ({
    createdAt: session.createdAt,
    expiresAt: session.expiresAt,
    isCurrent: session.id === currentSessionId,
  }));
}

export type RevokeOtherSessionsResult = { ok: true; revoked: number } | { ok: false; error: string };

export async function revokeOtherSessions(
  userId: string,
  currentPassword: string,
): Promise<RevokeOtherSessionsResult> {
  const currentSessionId = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!currentSessionId) return { ok: false, error: "Your current session could not be confirmed. Sign in again." };

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { passwordHash: true, email: true, organizationId: true },
  });
  if (!user || !(await bcrypt.compare(currentPassword, user.passwordHash))) {
    return { ok: false, error: "Your current password did not match." };
  }

  // The user id is taken from the authenticated session by the action. The
  // cookie id is retained, so this browser remains signed in after recovery.
  const revoked = await prisma.session.deleteMany({
    where: { userId, id: { not: currentSessionId } },
  });
  await writeAuditLog({
    organizationId: user.organizationId,
    actorUserId: userId,
    actorEmail: user.email,
    action: "other_sessions_revoked",
    outcome: "allowed",
  });
  return { ok: true, revoked: revoked.count };
}
