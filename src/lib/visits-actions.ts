// src/lib/visits-actions.ts
"use server";

// Thin wrappers between the browser and src/lib/visits.ts. They do exactly
// three things: work out WHO is asking (from the session cookie, on the
// server - never from anything the browser sends), hand the request to
// the service layer where every real rule lives, and turn the answer into
// something a form can show.
//
// Nothing here decides access. If a rule seems to be missing from this
// file, that is correct: it lives in visits.ts, in one place, so it
// cannot be skipped by calling these actions a different way.
//
// A note on why forged requests matter: a Server Action is a public HTTP
// endpoint. Anyone signed in can call these directly, with any values,
// skipping the form entirely. That is exactly why the service layer
// re-checks permission and relationship on every single call, and why
// the form hiding a button is never the security control.

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth/session";
import { AuthorizationError } from "@/lib/auth/authorize";
import { changeVisitStatus, scheduleVisit } from "@/lib/visits";

export interface VisitActionResult {
  ok: boolean;
  error?: string;
}

const SIGNED_OUT = "Your session has expired. Sign in again.";

export async function scheduleVisitAction(
  formData: FormData,
): Promise<VisitActionResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: SIGNED_OUT };

  try {
    const result = await scheduleVisit(user.id, {
      patientId: String(formData.get("patientId") ?? ""),
      clinicianId: String(formData.get("clinicianId") ?? ""),
      visitType: String(formData.get("visitType") ?? ""),
      startLocal: String(formData.get("startLocal") ?? ""),
      durationMinutes: Number(formData.get("durationMinutes")),
    });

    if (!result.ok) return { ok: false, error: result.error };

    revalidatePath("/visits");
    return { ok: true };
  } catch (err) {
    if (err instanceof AuthorizationError) {
      // requirePermission has already written the permission_denied
      // audit entry by the time it throws.
      return { ok: false, error: "You do not have permission to schedule visits." };
    }
    throw err;
  }
}

export async function changeVisitStatusAction(
  visitId: string,
  action: string,
): Promise<VisitActionResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: SIGNED_OUT };

  try {
    const result = await changeVisitStatus(user.id, visitId, action);

    if (!result.ok) return { ok: false, error: result.error };

    revalidatePath("/visits");
    return { ok: true };
  } catch (err) {
    if (err instanceof AuthorizationError) {
      return { ok: false, error: "You do not have permission to change visits." };
    }
    throw err;
  }
}
