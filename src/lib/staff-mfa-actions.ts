"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth/session";
import { AuthorizationError } from "@/lib/auth/authorize";
import { resetStaffMfa } from "@/lib/staff-mfa";

export type StaffMfaResetActionResult = { ok: boolean; error?: string };

export async function resetStaffMfaAction(formData: FormData): Promise<StaffMfaResetActionResult> {
  const actor = await getCurrentUser();
  if (!actor) return { ok: false, error: "Your session has expired. Sign in again." };
  try {
    const result = await resetStaffMfa(
      actor.id,
      String(formData.get("targetUserId") ?? ""),
      String(formData.get("currentPassword") ?? ""),
    );
    if (!result.ok) return result;
    revalidatePath("/staff");
    return { ok: true };
  } catch (error) {
    if (error instanceof AuthorizationError) return { ok: false, error: "You do not have permission to do that." };
    throw error;
  }
}
