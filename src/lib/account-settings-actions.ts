"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth/session";
import { changeOwnPassword, transferSuperAdmin, updateOwnProfile, type AccountSettingsResult } from "@/lib/account-settings";

const noSession = { ok: false, error: "Your session has ended. Please sign in again." } as const;

export async function updateOwnProfileAction(
  _previous: AccountSettingsResult,
  formData: FormData,
): Promise<AccountSettingsResult> {
  const user = await getCurrentUser();
  if (!user) return noSession;
  const result = await updateOwnProfile(user.id, {
    name: String(formData.get("name") ?? ""),
    email: String(formData.get("email") ?? ""),
    currentPassword: String(formData.get("currentPassword") ?? ""),
  });
  if (result.ok) revalidatePath("/account");
  return result;
}

export async function changeOwnPasswordAction(
  _previous: AccountSettingsResult,
  formData: FormData,
): Promise<AccountSettingsResult> {
  const user = await getCurrentUser();
  if (!user) return noSession;
  return changeOwnPassword(user.id, {
    currentPassword: String(formData.get("currentPassword") ?? ""),
    password: String(formData.get("password") ?? ""),
    confirmPassword: String(formData.get("confirmPassword") ?? ""),
  });
}

export async function transferSuperAdminAction(
  _previous: AccountSettingsResult,
  formData: FormData,
): Promise<AccountSettingsResult> {
  const user = await getCurrentUser();
  if (!user) return noSession;
  const result = await transferSuperAdmin(user.id, {
    targetUserId: String(formData.get("targetUserId") ?? ""),
    currentPassword: String(formData.get("currentPassword") ?? ""),
  });
  if (result.ok) revalidatePath("/account");
  return result;
}
