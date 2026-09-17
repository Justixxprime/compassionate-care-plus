// src/lib/auth/actions.ts
"use server";

import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { createSession, destroySession, getCurrentUser } from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/audit/log";

export interface SignInState {
  error?: string;
}

const DUMMY_HASH =
  "$2a$12$CwTycUXWue0Thq9StjUM0uJ8gU8XZW/kDMS3g7wUn9zPzxpTFO.C6";

export async function signInAction(
  _prevState: SignInState,
  formData: FormData,
): Promise<SignInState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    return { error: "Enter both an email and a password." };
  }

  const user = await prisma.user.findUnique({ where: { email } });
  const passwordMatches = await bcrypt.compare(password, user?.passwordHash ?? DUMMY_HASH);

  if (!user || !passwordMatches) {
    await writeAuditLog({ actorEmail: email, action: "sign_in_failed", outcome: "denied" });
    return { error: "That email and password do not match." };
  }

  await createSession(user.id);
  await writeAuditLog({ actorUserId: user.id, actorEmail: user.email, action: "sign_in", outcome: "allowed" });
  redirect("/dashboard");
}

export async function signOutAction() {
  const user = await getCurrentUser();
  await destroySession();

  if (user) {
    await writeAuditLog({ actorUserId: user.id, actorEmail: user.email, action: "sign_out", outcome: "allowed" });
  }

  redirect("/sign-in");
}