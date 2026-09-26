"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth/session";
import { AuthorizationError } from "@/lib/auth/authorize";
import { reviewCaregiverVisitUpdate } from "@/lib/caregiver-visit-updates";

export async function reviewCaregiverVisitUpdateAction(visitId: string): Promise<{ ok: boolean; error?: string }> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Your session has expired. Sign in again." };
  try {
    const result = await reviewCaregiverVisitUpdate(user.id, visitId);
    if (!result.ok) return { ok: false, error: result.error };
    revalidatePath(`/visits/${visitId}`);
    return { ok: true };
  } catch (err) {
    if (err instanceof AuthorizationError) return { ok: false, error: "You do not have permission to do that." };
    throw err;
  }
}
