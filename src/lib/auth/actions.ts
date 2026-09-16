// src/lib/auth/actions.ts
"use server";

import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { createSession, destroySession } from "@/lib/auth/session";

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

  if (!user || !passwordMatches) {
    return { error: "That email and password do not match." };
  }

  await createSession(user.id);
  redirect("/dashboard");
}

export async function signOutAction() {
  await destroySession();
  redirect("/sign-in");
}