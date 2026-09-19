// src/lib/care-plans-actions.ts
"use server";

// Thin wrappers between the browser and src/lib/care-plans.ts, exactly
// like visits-actions.ts. They do three things: work out WHO is asking
// (from the session cookie, on the server - never from anything the
// browser sends), hand the request to the service layer where every real
// rule lives, and turn the answer into something a form can show.
//
// Nothing here decides access. A Server Action is a public HTTP
// endpoint: anyone signed in can call these directly with any values,
// skipping the form entirely. That is exactly why the service layer
// re-checks permission, relationship and team membership on every call.

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth/session";
import { AuthorizationError } from "@/lib/auth/authorize";
import {
  addGoal,
  changePlanStatus,
  createCarePlan,
  markGoalMet,
  removeGoal,
  updateCarePlan,
} from "@/lib/care-plans";

export interface PlanActionResult {
  ok: boolean;
  error?: string;
}

const SIGNED_OUT = "Your session has expired. Sign in again.";
const NO_PERMISSION = "You do not have permission to do that.";

// Runs one service call as the signed-in person and shapes the outcome.
async function run(
  work: (userId: string) => Promise<{ ok: boolean; error?: string }>,
): Promise<PlanActionResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: SIGNED_OUT };

  try {
    const result = await work(user.id);
    if (!result.ok) return { ok: false, error: result.error };
    revalidatePath("/care-plans");
    return { ok: true };
  } catch (err) {
    if (err instanceof AuthorizationError) {
      // requirePermission has already written the permission_denied
      // audit entry by the time it throws.
      return { ok: false, error: NO_PERMISSION };
    }
    throw err;
  }
}

const text = (data: FormData, key: string) => String(data.get(key) ?? "");

export async function createCarePlanAction(
  formData: FormData,
): Promise<PlanActionResult> {
  return run((userId) =>
    createCarePlan(userId, {
      patientId: text(formData, "patientId"),
      title: text(formData, "title"),
      summary: text(formData, "summary"),
    }),
  );
}

export async function updateCarePlanAction(
  planId: string,
  formData: FormData,
): Promise<PlanActionResult> {
  return run((userId) =>
    updateCarePlan(userId, planId, {
      title: text(formData, "title"),
      summary: text(formData, "summary"),
    }),
  );
}

export async function addGoalAction(
  planId: string,
  formData: FormData,
): Promise<PlanActionResult> {
  return run((userId) => addGoal(userId, planId, text(formData, "description")));
}

export async function removeGoalAction(goalId: string): Promise<PlanActionResult> {
  return run((userId) => removeGoal(userId, goalId));
}

export async function markGoalMetAction(goalId: string): Promise<PlanActionResult> {
  return run((userId) => markGoalMet(userId, goalId));
}

export async function changePlanStatusAction(
  planId: string,
  action: string,
): Promise<PlanActionResult> {
  return run((userId) => changePlanStatus(userId, planId, action));
}
