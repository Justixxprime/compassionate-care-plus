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

export async function createSession(userId: string) {
  const session = await prisma.session.create({
    data: {
      userId,
      expiresAt: new Date(Date.now() + SESSION_DURATION_MS),
    },
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