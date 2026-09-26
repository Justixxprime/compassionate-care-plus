// src/lib/auth/session.ts
//
// Sessions are stored as real rows in the "sessions" table, not just
// inside a signed cookie (a JWT). The cookie only ever holds the
// session's id. This is what lets a compromised account be shut down
// immediately by deleting its session rows - a JWT-only session keeps
// working until it expires on its own, no matter what happens on the
// server in the meantime.
//
// "server-only" makes it a build error to accidentally import this from
// a Client Component - this file touches the database and reads
// httpOnly cookies, neither of which a Client Component is allowed to
// do anyway, but this turns a subtle runtime mistake into a loud one at
// build time instead.

import "server-only";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";

const SESSION_COOKIE = "ccp_session";
const SESSION_DURATION_MS = 1000 * 60 * 60 * 24 * 7; // 7 days
const MAX_ACTIVE_SESSIONS = 5;

export async function createSession(userId: string) {
  const now = new Date();
  const session = await prisma.$transaction(async (tx) => {
    // An account cannot quietly accumulate unlimited valid sessions. Remove
    // expired rows first, then retire the oldest active ones before adding a
    // new session. The cookie holds only the new session id.
    await tx.session.deleteMany({ where: { userId, expiresAt: { lt: now } } });
    const active = await tx.session.findMany({
      where: { userId, expiresAt: { gte: now } },
      orderBy: { expiresAt: "asc" },
      select: { id: true },
    });
    const retire = active.slice(0, Math.max(0, active.length - (MAX_ACTIVE_SESSIONS - 1)));
    if (retire.length) await tx.session.deleteMany({ where: { id: { in: retire.map((s) => s.id) } } });
    return tx.session.create({ data: { userId, expiresAt: new Date(now.getTime() + SESSION_DURATION_MS) } });
  });

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, session.id, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: session.expiresAt,
  });
}

export { MAX_ACTIVE_SESSIONS };

// Returns the signed-in user (with their roles attached), or null if
// nobody is signed in - including the case where the cookie points at a
// session that has since expired, in which case the stale row is
// cleaned up on the way out.
export async function getCurrentUser() {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get(SESSION_COOKIE)?.value;

  if (!sessionId) return null;

  const session = await prisma.session.findUnique({
    where: { id: sessionId },
    include: {
      user: {
        include: {
          userRoles: { include: { role: true } },
        },
      },
    },
  });

  if (!session) return null;

  if (session.expiresAt < new Date()) {
    await prisma.session.delete({ where: { id: session.id } }).catch(() => {});
    return null;
  }

  return session.user;
}

export async function destroySession() {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get(SESSION_COOKIE)?.value;

  if (sessionId) {
    await prisma.session.delete({ where: { id: sessionId } }).catch(() => {});
  }

  cookieStore.delete(SESSION_COOKIE);
}
