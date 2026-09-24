// src/lib/caregiver-actions.ts
"use server";

// A thin wrapper between the browser and src/lib/caregiver.ts, exactly
// like visits-actions.ts. It works out WHO is asking (from the session
// cookie, on the server), hands the request to the service where every
// real rule lives, and turns the answer into something a button can show.
// Nothing here decides access: a Server Action is a public HTTP endpoint,
// so the service re-checks permission, reach and ownership on every tap.

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth/session";
import { AuthorizationError } from "@/lib/auth/authorize";
import { caregiverVisitAction } from "@/lib/caregiver";

export interface CaregiverActionResult {
  ok: boolean;
  error?: string;
}

export async function caregiverVisitActionAction(
  visitId: string,
  action: string,
): Promise<CaregiverActionResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Your session has expired. Sign in again." };

  try {
    const result = await caregiverVisitAction(user.id, visitId, action);
    if (!result.ok) return { ok: false, error: result.error };

    revalidatePath("/caregiver");
    revalidatePath("/dashboard");
    revalidatePath("/visits");
    return { ok: true };
  } catch (err) {
    if (err instanceof AuthorizationError) {
      return { ok: false, error: "You do not have permission to do that." };
    }
    throw err;
  }
}
