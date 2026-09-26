// src/lib/auth/actions.ts
"use server";

import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { createSession, destroySession, getCurrentUser } from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/audit/log";
import { clearFailedSignIns, recordFailedSignIn, signInLockStatus } from "@/lib/auth/login-rate-limit";

export interface SignInState {
  error?: string;
}

// A real, valid bcrypt hash of a password nobody uses. Compared against
// whenever the email does not match a real user, so a login attempt for
// an email that does not exist takes the same amount of time as one
// that does - otherwise the response time itself would quietly confirm
// which emails have accounts.
const DUMMY_HASH =
  "$2a$12$CwTycUXWue0Thq9StjUM0uJ8gU8XZW/kDMS3g7wUn9zPzxpTFO.C6";

export async function signInAction(
  _prevState: SignInState,
  formData: FormData,
): Promise<SignInState> {
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    return { error: "Enter both an email and a password." };
  }

  const user = await prisma.user.findUnique({ where: { email } });

  const passwordMatches = await bcrypt.compare(
    password,
    user?.passwordHash ?? DUMMY_HASH,
  );

  // Compare before reporting the lock state, so a known and unknown address
  // take the same password-work path. A lock applies to the input address,
  // never a disclosed account record.
  const lock = await signInLockStatus(email);
  if (lock.locked) {
    await writeAuditLog({ actorEmail: email, action: "sign_in_rate_limited", outcome: "denied" });
    return { error: "Too many sign-in attempts. Try again in a few minutes." };
  }

  if (!user || !passwordMatches) {
    // Logged against the email that was TRIED, not a real account -
    // there is no user row to attach this to when the email doesn't
    // exist, but the attempt itself is still worth a record. Repeated
    // failures against one email is exactly the pattern a future
    // lockout policy would watch for.
    await writeAuditLog({
      actorEmail: email,
      action: "sign_in_failed",
      outcome: "denied",
    });
    await recordFailedSignIn(email);
    return { error: "That email and password do not match." };
  }

  await clearFailedSignIns(email);
  await createSession(user.id);
  await writeAuditLog({
    organizationId: user.organizationId,
    actorUserId: user.id,
    actorEmail: user.email,
    action: "sign_in",
    outcome: "allowed",
  });
  redirect("/dashboard");
}

export async function signOutAction() {
  // Read who's signed in BEFORE destroying the session - once
  // destroySession() runs, the cookie and the session row are both gone
  // and there is nothing left to attribute the log entry to.
  const user = await getCurrentUser();
  await destroySession();

  if (user) {
    await writeAuditLog({
      organizationId: user.organizationId,
      actorUserId: user.id,
      actorEmail: user.email,
      action: "sign_out",
      outcome: "allowed",
    });
  }

  redirect("/sign-in");
}
