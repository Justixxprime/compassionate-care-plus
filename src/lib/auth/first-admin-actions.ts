"use server";

import { redirect } from "next/navigation";
import { createSession } from "@/lib/auth/session";
import { createFirstAdmin, type FirstAdminResult } from "@/lib/auth/first-admin";

export async function createFirstAdminAction(
  _previous: FirstAdminResult,
  formData: FormData,
): Promise<FirstAdminResult> {
  const result = await createFirstAdmin({
    name: String(formData.get("name") ?? ""),
    email: String(formData.get("email") ?? ""),
    password: String(formData.get("password") ?? ""),
    confirmPassword: String(formData.get("confirmPassword") ?? ""),
    setupToken: String(formData.get("setupToken") ?? ""),
  });
  if (result.ok) {
    await createSession(result.userId);
    redirect("/dashboard");
  }
  return result;
}
