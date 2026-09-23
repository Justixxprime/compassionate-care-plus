// src/lib/referrals-actions.ts
"use server";

// Thin wrappers between the browser and src/lib/referrals.ts, exactly
// like care-plans-actions.ts. They do three things: work out WHO is
// asking (from the session cookie, on the server - never from anything
// the browser sends), hand the request to the service layer where every
// real rule lives, and turn the answer into something a form can show.
//
// Nothing here decides access. A Server Action is a public HTTP
// endpoint: anyone signed in can call these directly with any values,
// skipping the form entirely. That is exactly why the service layer
// re-checks permission, reach and fields on every call.

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth/session";
import { AuthorizationError } from "@/lib/auth/authorize";
import {
  changeReferralStatus,
  createReferral,
  updateReferral,
  type ReferralDetailsInput,
} from "@/lib/referrals";

export interface ReferralActionResult {
  ok: boolean;
  error?: string;
  patientId?: string | null;
}

const SIGNED_OUT = "Your session has expired. Sign in again.";
const NO_PERMISSION = "You do not have permission to do that.";

// Runs one service call as the signed-in person and shapes the outcome.
async function run(
  work: (userId: string) => Promise<{ ok: boolean; error?: string }>,
): Promise<ReferralActionResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: SIGNED_OUT };

  try {
    const result = await work(user.id);
    if (!result.ok) return { ok: false, error: result.error };
    revalidatePath("/referrals");
    // Accepting can create a patient, so the patient list is stale too.
    revalidatePath("/patients");
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

function detailsFrom(formData: FormData): ReferralDetailsInput {
  return {
    firstName: text(formData, "firstName"),
    lastName: text(formData, "lastName"),
    dateOfBirth: text(formData, "dateOfBirth"),
    sourceType: text(formData, "sourceType"),
    sourceOrganization: text(formData, "sourceOrganization"),
    sourceContactName: text(formData, "sourceContactName"),
    sourceContactPhone: text(formData, "sourceContactPhone"),
    requestedService: text(formData, "requestedService"),
    urgency: text(formData, "urgency"),
    reason: text(formData, "reason"),
    officeNotes: text(formData, "officeNotes"),
  };
}

export async function createReferralAction(
  formData: FormData,
): Promise<ReferralActionResult> {
  return run((userId) => createReferral(userId, detailsFrom(formData)));
}

export async function updateReferralAction(
  referralId: string,
  formData: FormData,
): Promise<ReferralActionResult> {
  return run((userId) => updateReferral(userId, referralId, detailsFrom(formData)));
}

export async function changeReferralStatusAction(
  referralId: string,
  action: string,
  input: { note?: string; existingPatientId?: string | null } = {},
): Promise<ReferralActionResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: SIGNED_OUT };

  try {
    const result = await changeReferralStatus(user.id, referralId, action, {
      note: typeof input.note === "string" ? input.note : undefined,
      existingPatientId:
        typeof input.existingPatientId === "string"
          ? input.existingPatientId
          : null,
    });
    if (!result.ok) return { ok: false, error: result.error };
    revalidatePath("/referrals");
    // Accepting can create a patient, so the patient list is stale too.
    revalidatePath("/patients");
    // Accepting links (or creates) a patient - the caller uses this to
    // send the coordinator straight to that patient's care team so
    // accepting and assigning is one flow, not two separate trips.
    return { ok: true, patientId: result.value.patientId };
  } catch (err) {
    if (err instanceof AuthorizationError) {
      return { ok: false, error: NO_PERMISSION };
    }
    throw err;
  }
}
