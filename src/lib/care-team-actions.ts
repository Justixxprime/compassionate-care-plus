// src/lib/care-team-actions.ts
"use server";

// Thin wrappers between the browser and src/lib/care-team.ts, exactly
// like referrals-actions.ts and visits-actions.ts. Nothing here decides
// access - assignToCareTeam and endCareTeamAssignment re-check
// permission, reach and every team rule on every call.

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth/session";
import { AuthorizationError } from "@/lib/auth/authorize";
import { assignToCareTeam, endCareTeamAssignment } from "@/lib/care-team";

export interface CareTeamActionResult {
  ok: boolean;
  error?: string;
  futureVisitsToReassign?: number;
}

const SIGNED_OUT = "Your session has expired. Sign in again.";
const NO_PERMISSION = "You do not have permission to do that.";

export async function assignToCareTeamAction(
  formData: FormData,
): Promise<CareTeamActionResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: SIGNED_OUT };

  const patientId = String(formData.get("patientId") ?? "");
  const staffId = String(formData.get("staffId") ?? "");
  const roleOnCase = String(formData.get("roleOnCase") ?? "");

  try {
    const result = await assignToCareTeam(user.id, {
      patientId,
      staffId,
      roleOnCase,
    });
    if (!result.ok) return { ok: false, error: result.error };
    revalidatePath(`/patients/${patientId}`);
    revalidatePath("/patients");
    revalidatePath("/dashboard");
    return { ok: true };
  } catch (err) {
    if (err instanceof AuthorizationError) return { ok: false, error: NO_PERMISSION };
    throw err;
  }
}

export async function endCareTeamAssignmentAction(
  assignmentId: string,
  patientId: string,
): Promise<CareTeamActionResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: SIGNED_OUT };

  try {
    const result = await endCareTeamAssignment(user.id, assignmentId);
    if (!result.ok) return { ok: false, error: result.error };
    revalidatePath(`/patients/${patientId}`);
    revalidatePath("/patients");
    revalidatePath("/dashboard");
    return { ok: true, futureVisitsToReassign: result.value.futureVisitsToReassign };
  } catch (err) {
    if (err instanceof AuthorizationError) return { ok: false, error: NO_PERMISSION };
    throw err;
  }
}
