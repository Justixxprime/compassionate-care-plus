// Short-window protection for password guessing. This stores no password,
// user id, or e-mail address: only a one-way hash of normalized input.
import "server-only";
import { createHash } from "crypto";
import { prisma } from "@/lib/prisma";

export const MAX_FAILED_SIGN_INS = 5;
export const SIGN_IN_WINDOW_MS = 15 * 60 * 1000;

function identifierHash(email: string) {
  return createHash("sha256").update(email).digest("hex");
}

export async function signInLockStatus(email: string, now = new Date()) {
  const hash = identifierHash(email);
  const since = new Date(now.getTime() - SIGN_IN_WINDOW_MS);
  const latest = await prisma.signInFailure.findFirst({
    where: { identifierHash: hash, occurredAt: { gte: since } },
    orderBy: { occurredAt: "desc" },
    select: { occurredAt: true },
  });
  if (!latest) return { locked: false, retryAt: null };
  const count = await prisma.signInFailure.count({
    where: { identifierHash: hash, occurredAt: { gte: since } },
  });
  return {
    locked: count >= MAX_FAILED_SIGN_INS,
    retryAt: count >= MAX_FAILED_SIGN_INS ? new Date(latest.occurredAt.getTime() + SIGN_IN_WINDOW_MS) : null,
  };
}

export async function recordFailedSignIn(email: string, now = new Date()) {
  await prisma.signInFailure.create({ data: { identifierHash: identifierHash(email), occurredAt: now } });
}

export async function clearFailedSignIns(email: string) {
  await prisma.signInFailure.deleteMany({ where: { identifierHash: identifierHash(email) } });
}
