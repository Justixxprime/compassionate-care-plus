"use server";

// src/lib/care-requests-actions.ts
//
// Two very different doors onto src/lib/care-requests.ts:
//
//   submitCareRequestAction   PUBLIC. Anyone on the internet, signed in
//                             or not, can call this - it is what the
//                             /request-care page's form posts to. It
//                             does not look for a session at all;
//                             createCareRequest does its own checking
//                             of what was typed.
//   changeCareRequestStatusAction   Staff only, same shape as every
//                             other action file (tasks-actions.ts,
//                             accounts-actions.ts): find out who is
//                             asking from the session cookie, then let
//                             the service layer decide everything else.

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth/session";
import { AuthorizationError } from "@/lib/auth/authorize";
import { changeCareRequestStatus, createCareRequest } from "@/lib/care-requests";

export interface CareRequestActionResult {
  ok: boolean;
  error?: string;
}

const SIGNED_OUT = "Your session has expired. Sign in again.";
const NO_PERMISSION = "You do not have permission to do that.";

const text = (data: FormData, key: string) => String(data.get(key) ?? "");

export async function submitCareRequestAction(
  formData: FormData,
): Promise<CareRequestActionResult> {
  const result = await createCareRequest({
    fullName: text(formData, "fullName"),
    relationship: text(formData, "relationship"),
    email: text(formData, "email"),
    phone: text(formData, "phone"),
    preferredContact: text(formData, "preferredContact"),
    serviceInterest: text(formData, "serviceInterest"),
    bestTime: text(formData, "bestTime"),
    message: text(formData, "message"),
    // The honeypot field's real name on the form, kept out of the other
    // field names above on purpose - see request-care-form.tsx.
    honeypot: text(formData, "companyWebsite"),
  });
  if (!result.ok) return { ok: false, error: result.error };
  return { ok: true };
}

export async function changeCareRequestStatusAction(
  requestId: string,
  action: string,
): Promise<CareRequestActionResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: SIGNED_OUT };
  try {
    const result = await changeCareRequestStatus(user.id, requestId, action);
    if (!result.ok) return { ok: false, error: result.error };
    revalidatePath("/care-requests");
    return { ok: true };
  } catch (err) {
    if (err instanceof AuthorizationError) return { ok: false, error: NO_PERMISSION };
    throw err;
  }
}
