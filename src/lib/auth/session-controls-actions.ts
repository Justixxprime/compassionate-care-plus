"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth/session";
import { revokeOtherSessions } from "@/lib/auth/session-controls";

export type RevokeOtherSessionsActionResult = { ok: boolean; error?: string; revoked?: number };

export async function revokeOtherSessionsAction(
  formData: FormData,
): Promise<RevokeOtherSessionsActionResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Your session has expired. Sign in again." };
  const result = await revokeOtherSessions(user.id, String(formData.get("currentPassword") ?? ""));
  if (!result.ok) return result;
  revalidatePath("/security/sessions");
  return result;
}
